import { h, clear } from "./utils.js";
import { t } from "./data.js";
import { currentPath } from "./router.js";
import { getReviewer, signOutReviewer } from "./review-auth.js";

const NAV_ITEMS = [
  { path: "/", key: "nav.home", fallback: "Home" },
  { path: "/handbook", key: "nav.handbook", fallback: "Handbook" },
  { path: "/builder", key: "nav.builder", fallback: "Build an Agreement" },
  { path: "/updates", key: "nav.updates", fallback: "Updates" },
];

export function renderHeader(db) {
  const header = document.getElementById("site-header");
  clear(header);
  const active = currentPath();
  if (active === "/") return; // landing page: no nav, no repeated title

  const reviewer = getReviewer();

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

  const reviewerChip = reviewer
    ? h("div", { className: "reviewer-chip" }, [
        `${t(db, "review.reviewing_as", "Reviewing as")} ${reviewer.role}`,
        h("button", { onClick: () => { signOutReviewer(); location.hash = "/handbook"; location.reload(); } }, t(db, "review.sign_out", "Sign out")),
      ])
    : null;

  header.appendChild(
    h("div", { className: "site-header__inner" }, [
      h("a", { className: "site-header__brand", href: "#/" }, t(db, "site.title", "Digital Ceasefire Platform")),
      h("div", { className: "cluster" }, [nav, reviewerChip]),
    ])
  );
}

export function renderFooter(db) {
  const footer = document.getElementById("site-footer");
  clear(footer);
  footer.appendChild(
    h("div", { className: "container" }, [
      h("p", {}, t(db, "footer.data_source", "")),
      h("p", {}, t(db, "footer.disclaimer", "")),
    ])
  );
}
