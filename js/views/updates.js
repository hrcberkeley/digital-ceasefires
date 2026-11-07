import { h } from "../utils.js";
import { t } from "../data.js";
import { formatDate, renderMarkdown } from "../utils.js";

export function renderUpdatesList({ mountEl, db }) {
  mountEl.appendChild(
    h("div", { className: "container section-pad" }, [
      h("div", { className: "prose" }, [
        h("h1", {}, t(db, "nav.updates", "Updates")),
        ...db.posts.map((post) => {
          const { text, more } = preview(post.body_markdown);
          return h("article", { className: "post-card" }, [
            h("h2", {}, h("a", { href: `#/updates/${post.post_id}` }, post.title)),
            h("div", { className: "post-meta" }, `${formatDate(post.date)} · ${post.author_role}`),
            h("div", { className: "prose", html: renderMarkdown(text) }),
            more ? h("p", {}, h("a", { href: `#/updates/${post.post_id}` }, "Read more →")) : null,
          ]);
        }),
      ]),
    ])
  );
}

export function renderUpdatePost({ mountEl, db, params }) {
  const post = db.posts.find((p) => p.post_id === params.id);
  if (!post) {
    mountEl.appendChild(h("div", { className: "container section-pad" }, h("p", {}, "Post not found.")));
    return;
  }
  mountEl.appendChild(
    h("article", { className: "container section-pad" }, [
      h("div", { className: "prose" }, [
        h("p", {}, h("a", { href: "#/updates" }, `← ${t(db, "nav.updates", "Updates")}`)),
        h("h1", {}, post.title),
        h("div", { className: "post-meta" }, `${formatDate(post.date)} · ${post.author_role}`),
        h("div", { html: renderMarkdown(post.body_markdown) }),
      ]),
    ])
  );
}

// Preview = whole paragraphs (markdown kept) until ~200 characters; skips headings.
function preview(markdown, minLen = 200) {
  const paras = markdown.split(/\n\s*\n/).filter((p) => p.trim() && !/^#/.test(p.trim()));
  let out = "", i = 0;
  while (i < paras.length && out.length < minLen) out += (out ? "\n\n" : "") + paras[i++];
  return { text: out, more: i < paras.length };
}
