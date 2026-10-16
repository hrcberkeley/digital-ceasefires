import { h } from "../utils.js";
import { t } from "../data.js";

export function renderHome({ mountEl, db }) {
  const options = [
    ["/handbook", "home.cta_read", "Read the Handbook", "home.cta_read.desc", "Browse the full text of the Handbook, section by section."],
    ["/builder", "home.cta_build", "Build an Agreement", "home.cta_build.desc", "Assemble a customized ceasefire, de-escalation, or other agreement from the available provisions."],
    ["/updates", "nav.updates", "Updates", "home.cta_updates.desc", "See the latest posts, news and updates to the Platform."],
  ];

  // Title set as three staggered lines, AFfacts-style; chunks follow word count so sheet edits still work.
  const words = t(db, "home.hero_title", "Digital Ceasefire & De-escalation Handbook").split(" ");
  const per = Math.ceil(words.length / 3);
  const lines = [];
  for (let i = 0; i < words.length; i += per) lines.push(words.slice(i, i + per).join(" "));

  mountEl.appendChild(
    h("div", { className: "container" }, [
      h("section", { className: "hero" }, [
        h("h1", {}, lines.map((line) => h("span", {}, line))),
        h("div", { className: "hero-intro" }, [
          h("p", { className: "eyebrow" }, t(db, "home.eyebrow", "Human Rights Center · Digital Ceasefire Initiative")),
          h("p", { className: "hero-lede" }, t(db, "home.hero_subtitle", "A practical framework for mediators, negotiators, and affected communities to negotiate, draft, and implement ceasefire, de-escalation, and other agreements to constrain digital operations during conflict and other security contexts.")),
        ]),
      ]),
      h(
        "nav",
        { className: "home-rows", "aria-label": "Start here" },
        options.map(([path, labelKey, labelFallback, descKey, descFallback], i) =>
          h("a", { className: "home-row", href: `#${path}` }, [
            h("span", { className: "home-row__num" }, String(i + 1)),
            h("span", { className: "home-row__title" }, t(db, labelKey, labelFallback)),
            h("span", { className: "home-row__desc" }, t(db, descKey, descFallback)),
            h("span", { className: "home-row__arrow", "aria-hidden": "true" }, "→"),
          ])
        )
      ),
    ])
  );
}
