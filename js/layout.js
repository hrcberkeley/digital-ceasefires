import { h, clear, openModal } from "./utils.js";
import { t } from "./data.js";
import { currentPath } from "./router.js";
import { getReviewer, signOutReviewer } from "./review-auth.js";

const NAV_ITEMS = [
  { path: "/", key: "nav.home", fallback: "Home" },
  { path: "/handbook", key: "nav.handbook", fallback: "Handbook" },
  { path: "/builder", key: "nav.builder", fallback: "Build an Agreement" },
  { path: "/updates", key: "nav.updates", fallback: "Updates" },
];

function openAboutModal(db) {
  let close;
  close = openModal({
    title: t(db, "about.title", "About"),
    body: [
      h("p", {}, t(db, "about.p1", "The Digital Ceasefire Platform is a creation of the Human Rights Center, Berkeley School of Law. The project is led by Betsy Popken and Bret Solomon.")),
      h("p", {}, [
        t(db, "about.p2_prefix", "The website was created by the Investigations Lab, Human Rights Center. "),
        h("strong", {}, t(db, "about.p2_bold", "AI Disclosure:")),
        t(db, "about.p2_suffix", " This platform was created using a combination of cloud and local models and LLM harnesses. All the text was produced by humans."),
      ]),
    ],
    actions: [h("button", { className: "btn btn-primary", onClick: () => close() }, t(db, "about.close", "Close"))],
  });
}

export function renderHeader(db) {
  const header = document.getElementById("site-header");
  clear(header);
  const active = currentPath();
  const aboutLink = h("a", { href: "#", className: "about-link", onClick: (e) => { e.preventDefault(); openAboutModal(db); } }, t(db, "nav.about", "About"));
  if (active === "/") {
    header.appendChild(h("div", { className: "site-header__inner" }, [aboutLink]));
    return; // landing page: no nav, no repeated title
  }

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
      h("div", { className: "cluster" }, [nav, aboutLink, reviewerChip]),
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
