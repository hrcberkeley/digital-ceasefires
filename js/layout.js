import { h, clear } from "./utils.js";
import { t } from "./data.js";
import { currentPath } from "./router.js";
import { signalField } from "./signal.js";

const NAV_ITEMS = [
  { path: "/", key: "nav.home", fallback: "Home" },
  { path: "/handbook", key: "nav.handbook", fallback: "Handbook" },
  { path: "/builder", key: "nav.builder", fallback: "Build an Agreement" },
  { path: "/updates", key: "nav.updates", fallback: "Updates" },
  { path: "/about", key: "nav.about", fallback: "About" },
];

export function renderHeader(db) {
  const header = document.getElementById("site-header");
  clear(header);
  const active = currentPath();
  const nav = h(
    "nav",
    { className: "site-nav", ariaLabel: "Primary" },
    NAV_ITEMS.map((item) =>
      h(
        "a",
        {
          href: `#${item.path}`,
          "aria-current": active === item.path ? "page" : null,
        },
        t(db, item.key, item.fallback)
      )
    )
  );

  header.appendChild(
    h("div", { className: "site-header__inner" }, [
      h("a", { className: "site-header__brand", href: "#/" }, t(db, "site.title", "Digital Ceasefire Platform")),
      h("div", { className: "cluster" }, [nav]),
    ])
  );
}

export function renderFooter(db) {
  const footer = document.getElementById("site-footer");
  clear(footer);
  const canvas = h("canvas", { className: "signal-field signal-foot", "aria-hidden": "true" });
  footer.append(canvas);
  footer.appendChild(
    h("div", { className: "container" }, [
      h("a", { className: "site-footer__logo", href: "https://humanrights.berkeley.edu/", target: "_blank", rel: "noopener" },
        h("img", { src: "data/hrc-wordmark.png", alt: "Human Rights Center, UC Berkeley School of Law", width: 689, height: 91 })),
      h("div", { className: "site-footer__text" }, [
        h("p", {}, t(db, "footer.data_source", "")),
        h("p", {}, t(db, "footer.disclaimer", "")),
      ]),
    ])
  );
  signalField(canvas, { alpha: 0.06, packets: 2 });
}
