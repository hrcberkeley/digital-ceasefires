-- pandoc filter: normalize the handbook .docx into the markdown shape extract.py expects
-- (the Google Docs export it was written against).
-- Usage: pandoc handbook.docx -t markdown-smart --wrap=none --lua-filter docx_to_md.lua -o handbook.md

-- underline / highlight are reviewer styling, not content
function Underline(el) return el.content end
function Span(el) return el.content end

-- headings are plain text; bold runs inside them ("3**.2.1 Misinformation**") break parsing
function Header(el)
  el.content = el.content:walk({ Strong = function(s) return s.content end })
  el.attr = pandoc.Attr()
  return el
end

-- v1.5 puts section guidance in a one-cell "Note to Users" box; extract.py reads
-- guidance as ***bold italic*** paragraphs.
function Table(el)
  local blocks = pandoc.Blocks({})
  for _, body in ipairs(el.bodies) do
    for _, row in ipairs(body.body) do
      for _, cell in ipairs(row.cells) do blocks:extend(cell.contents) end
    end
  end
  local first = blocks[1] and pandoc.utils.stringify(blocks[1]) or ""
  if not first:match("^%s*Note to Users:?%s*$") then return nil end
  local out = {}
  for i = 2, #blocks do
    local b = blocks[i]
    if b.t == "Para" or b.t == "Plain" then
      local inl = b.content:walk({ Strong = function(s) return s.content end,
                                   Emph = function(s) return s.content end })
      table.insert(out, pandoc.Para({ pandoc.Strong({ pandoc.Emph(inl) }) }))
    else
      table.insert(out, b)
    end
  end
  return out
end

-- indented paragraphs come through as blockquotes; they're ordinary body text
function BlockQuote(el) return el.content end
