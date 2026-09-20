import { h } from "../utils.js";
import { t } from "../data.js";
import { formatDate, renderMarkdown } from "../utils.js";

export function renderUpdatesList({ mountEl, db }) {
  mountEl.appendChild(
    h("div", { className: "container section-pad prose" }, [
      h("h1", {}, t(db, "nav.updates", "Updates")),
      ...db.posts.map((post) =>
        h("article", { className: "post-card" }, [
          h("h2", {}, h("a", { href: `#/updates/${post.post_id}` }, post.title)),
          h("div", { className: "post-meta" }, `${formatDate(post.date)} · ${post.author_role}`),
          h("div", { className: "prose", html: renderMarkdown(truncate(post.body_markdown)) }),
        ])
      ),
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
    h("article", { className: "container section-pad prose" }, [
      h("p", {}, h("a", { href: "#/updates" }, `← ${t(db, "nav.updates", "Updates")}`)),
      h("h1", {}, post.title),
      h("div", { className: "post-meta" }, `${formatDate(post.date)} · ${post.author_role}`),
      h("div", { html: renderMarkdown(post.body_markdown) }),
    ])
  );
}

function truncate(markdown, maxLen = 280) {
  const plain = markdown.replace(/[#*_`>-]/g, "");
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}...` : markdown;
}
