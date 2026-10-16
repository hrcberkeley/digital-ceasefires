import { h } from "../utils.js";
import { t } from "../data.js";

export function renderHome({ mountEl, db }) {
  const options = [
    ["/handbook", "home.cta_read", "Read the Handbook", "home.cta_read.desc", "Browse the full text of the Handbook, section by section."],
    ["/builder", "home.cta_build", "Build an Agreement", "home.cta_build.desc", "Assemble a customized ceasefire, de-escalation, or other agreement from the available provisions."],
    ["/updates", "nav.updates", "Updates", "home.cta_updates.desc", "See the latest posts, news and updates to the Platform."],
  ];

  mountEl.appendChild(
    h("div", { className: "container" }, [
      h("section", { className: "hero" }, [
        h("h1", {}, t(db, "home.hero_title", "Digital Ceasefire & De-escalation Handbook")),
        h("p", {}, t(db, "home.hero_subtitle", "A practical framework for mediators, negotiators, and affected communities to negotiate, draft, and implement ceasefire, de-escalation, and other agreements to constrain digital operations during conflict and other security contexts.")),
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
