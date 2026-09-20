import { loadData } from "./data.js";
import { route, notFound, start } from "./router.js";
import { renderHeader, renderFooter } from "./layout.js";
import { renderHome } from "./views/home.js";
import { renderHandbook } from "./views/handbook.js";
import { renderBuilder } from "./views/builder.js";
import { renderUpdatesList, renderUpdatePost } from "./views/updates.js";
import { renderRegister, renderReviewSignIn } from "./views/review.js";
import { h } from "./utils.js";

let db;

function withDb(renderFn) {
  return (ctx) => renderFn({ ...ctx, db });
}

function mountChrome() {
  renderHeader(db);
  renderFooter(db);
}

async function boot() {
  db = await loadData((freshDb) => {
    db = freshDb;
    mountChrome();
    // re-run the current route so it picks up fresh content
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });

  route("/", withDb(renderHome));
  route("/handbook", withDb(renderHandbook));
  route("/handbook/:sectionId", withDb(renderHandbook));
  route("/builder", withDb(renderBuilder));
  route("/updates", withDb(renderUpdatesList));
  route("/updates/:id", withDb(renderUpdatePost));
  route("/review/register", withDb(renderRegister));
  route("/review", withDb(renderReviewSignIn));
  notFound(({ mountEl }) => mountEl.appendChild(h("div", { className: "container section-pad" }, h("p", {}, "Page not found."))));

  mountChrome();
  start(document.getElementById("view"));

  // header nav highlight depends on the route, which the header doesn't listen for
  window.addEventListener("hashchange", () => renderHeader(db));
}

boot().catch((err) => {
  console.error("Failed to start the app:", err);
  document.getElementById("view").innerHTML = "<div class='container section-pad'><p>Something went wrong loading the site. Please refresh.</p></div>";
});
