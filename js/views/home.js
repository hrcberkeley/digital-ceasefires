import { h } from "../utils.js";
import { t } from "../data.js";

export function renderHome({ mountEl, db }) {
  const options = [
    ["/handbook", "home.cta_read", "Read the Handbook", "home.cta_read.desc", "Browse the full text of the agreement, section by section."],
    ["/builder", "home.cta_build", "Build an Agreement", "home.cta_build.desc", "Assemble a customized ceasefire agreement from the available provisions."],
    ["/review/register", "home.cta_review", "Become a Reviewer", "home.cta_review.desc", "Register to review and comment on proposed provisions."],
    ["/updates", "nav.updates", "Updates", "home.cta_updates.desc", "See the latest posts and changes to the platform."],
  ];

  mountEl.appendChild(
    h("div", { className: "container" }, [
      h("section", { className: "hero" }, [
        h("h1", {}, t(db, "home.hero_title", "Digital Ceasefire Platform")),
        h("p", {}, t(db, "home.hero_subtitle", "")),
      ]),
      h(
        "div",
        { className: "category-grid" },
        options.map(([path, labelKey, labelFallback, descKey, descFallback]) =>
          h("a", { className: "category-card", href: `#${path}` }, [
            h("h3", {}, t(db, labelKey, labelFallback)),
            h("p", { className: "muted" }, t(db, descKey, descFallback)),
          ])
        )
      ),
    ])
  );
}
