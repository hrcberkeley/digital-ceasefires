// 1 · Settle (subtle). The cover's chevron drawn once, crisp, in SVG. On load the bands rise into place
// one after another and the title follows; after that they only breathe a couple of pixels, a single
// glint crosses a seam every few seconds, and the pointer fans the bands sideways by a few pixels.
// No canvas, no per-frame JS: CSS animations plus one custom property set on pointer move.
import { cover, still } from "./lib.js";

const NS = "http://www.w3.org/2000/svg";
const W = 1000, H = 190, B = 13, TIP = 620, RISE = 90;

const css = `
.settle { background: var(--cover-navy); }
.settle svg { position: absolute; left: 0; bottom: 0; width: 100%; height: clamp(110px, 24vh, 190px); }
.settle .band { animation: settle-rise 1.4s cubic-bezier(.2, .8, .2, 1) both; animation-delay: calc(var(--i) * 90ms + 150ms); }
.settle polygon {
  animation: settle-breathe 9s ease-in-out infinite; animation-delay: calc(var(--i) * -0.7s);
  translate: calc(var(--nx, 0) * var(--i) * 5px) 0; transition: translate 1.6s cubic-bezier(.2, .8, .2, 1);
}
.settle .paper { animation: none; translate: none; }
@keyframes settle-rise { from { transform: translateY(70px); } }
@keyframes settle-breathe { 50% { transform: translateY(-2px); } }
.hero:has(.settle) h1 span, .hero:has(.settle) .hero-lede { animation: settle-in 1s cubic-bezier(.2, .8, .2, 1) both; }
.hero:has(.settle) h1 span:nth-child(2) { animation-delay: 120ms; }
.hero:has(.settle) h1 span:nth-child(3) { animation-delay: 240ms; }
.hero:has(.settle) .hero-lede { animation-delay: 420ms; }
@keyframes settle-in { from { opacity: 0; transform: translateY(12px); } }
@media (prefers-reduced-motion: reduce) { .settle *, .hero:has(.settle) * { animation: none !important; transition: none !important; } }
`;

// y of seam i (i = -1 is the navy's edge) at x: a straight-sided chevron, as printed on the cover
const seam = (i, x) => H - 6 - (6 - i) * B - (Math.abs(x - TIP) / (0.85 * W)) * RISE;
const pts = (i) => [-80, TIP, W + 80].map((x) => `${x},${seam(i, x)}`).join(" ");
const el = (tag, attrs) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

export default function settle(hero) {
  document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
  const { bands } = cover();
  const wrap = document.createElement("div");
  wrap.className = "signal-field chevron-field settle";
  wrap.setAttribute("aria-hidden", "true");
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none" });

  svg.append(el("defs", {}));
  svg.firstChild.innerHTML = `
    <filter id="settle-shadow" x="-5%" y="-50%" width="110%" height="200%">
      <feDropShadow dx="0" dy="-2" stdDeviation="0.6 3" flood-color="#000" flood-opacity="0.22"/>
    </filter>
    <linearGradient id="settle-glint" gradientUnits="userSpaceOnUse" x1="0" x2="120" y1="0" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      ${still ? "" : `<animateTransform attributeName="gradientTransform" type="translate" values="-200 0; 1100 0; 1100 0" keyTimes="0; .35; 1" dur="9s" repeatCount="indefinite"/>`}
    </linearGradient>`;

  bands.forEach((color, i) => {
    const g = el("g", { class: "band", style: `--i:${i}` });
    g.append(el("polygon", { points: `${pts(i - 1)} ${W + 80},${H + 80} -80,${H + 80}`, fill: color, filter: "url(#settle-shadow)", style: `--i:${i}` }));
    svg.append(g);
  });
  // below the last band the page shows through
  svg.append(el("polygon", { class: "paper", points: `${pts(6)} ${W + 80},${H + 80} -80,${H + 80}`, fill: "var(--color-paper)" }));
  // the glint rides the seam between cream and peach
  if (!still) svg.append(el("polyline", { points: pts(3), fill: "none", stroke: "url(#settle-glint)", "stroke-width": 2, "vector-effect": "non-scaling-stroke", "stroke-linecap": "round" }));

  wrap.append(svg);
  hero.prepend(wrap);
  addEventListener("pointermove", (e) => wrap.style.setProperty("--nx", (e.clientX / innerWidth - 0.5).toFixed(3)));
}
