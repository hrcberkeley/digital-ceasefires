// Hash-based routing so the site works on any static host without server rewrites
// (PRD s.5 "Routing"). Routes are registered as `/path/:param` patterns.
import { clear, h } from "./utils.js";

const routes = [];
const loader = h("div", { className: "loading", role: "status" }, "Loading...");
let mountEl = null;
let notFoundHandler = () => document.createTextNode("Not found");

export function route(pattern, handler) {
  const paramNames = [];
  const regexStr = pattern
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) {
        paramNames.push(seg.slice(1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  routes.push({ regex: new RegExp(`^${regexStr}$`), paramNames, handler });
}

export function notFound(handler) {
  notFoundHandler = handler;
}

function parseHash() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [path, queryStr] = hash.split("?");
  const query = Object.fromEntries(new URLSearchParams(queryStr || ""));
  return { path: path || "/", query };
}

async function render() {
  const { path, query } = parseHash();
  for (const r of routes) {
    const m = r.regex.exec(path);
    if (m) {
      const params = Object.fromEntries(r.paramNames.map((name, i) => [name, decodeURIComponent(m[i + 1])]));
      clear(mountEl);
      mountEl.appendChild(loader); // removed in the same task for sync handlers, so it only ever paints while one awaits
      mountEl.scrollTop = 0;
      window.scrollTo(0, 0);
      try {
        await r.handler({ params, query, mountEl });
      } finally {
        loader.remove();
      }
      return;
    }
  }
  clear(mountEl);
  await notFoundHandler({ mountEl });
}

export function start(el) {
  mountEl = el;
  window.addEventListener("hashchange", render);
  render();
}

export function navigate(path) {
  location.hash = path;
}

export function currentPath() {
  return parseHash().path;
}
