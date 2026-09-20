import { h } from "../utils.js";
import { t } from "../data.js";
import { REGISTRATION_FORM_URL } from "../config.js";
import { signInWithToken } from "../review-auth.js";
import { ApiError } from "../api.js";

// Registration happens through the Google Form the owner set up (PRD s.10.4),
// not a form we host -- the Sheet's onFormSubmit trigger is what creates the
// pending reviewer row. This page just explains that and links out to it.
export function renderRegister({ mountEl, db }) {
  const body = [h("h1", {}, t(db, "review.register_title", "Become a reviewer"))];
  if (REGISTRATION_FORM_URL) {
    body.push(
      h("p", {}, "Fill out the short form below. Once an admin approves your request, you'll get an email with a link to start reviewing."),
      h("a", { className: "btn btn-primary", href: REGISTRATION_FORM_URL, target: "_blank", rel: "noopener" }, "Open the registration form")
    );
  } else {
    body.push(h("p", { className: "muted" }, "Reviewer registration isn't set up yet -- check back soon."));
  }
  mountEl.appendChild(h("div", { className: "container section-pad prose" }, body));
}

export async function renderReviewSignIn({ mountEl, db, query }) {
  const wrap = h("div", { className: "container section-pad prose" });
  mountEl.appendChild(wrap);

  if (!query.t) {
    wrap.appendChild(h("p", {}, "Missing reviewer link."));
    return;
  }

  try {
    const reviewer = await signInWithToken(query.t);
    history.replaceState(null, "", `${location.pathname}${location.search}#/handbook`);
    wrap.appendChild(h("p", {}, `You're signed in as ${reviewer.role}. Redirecting to the Handbook...`));
    setTimeout(() => { location.hash = "/handbook"; location.reload(); }, 800);
  } catch (err) {
    const message = err instanceof ApiError && err.code === "invalid_token" ? t(db, "error.invalid_token", "") : t(db, "error.network", "");
    wrap.appendChild(h("p", { className: "form-error" }, message));
  }
}
