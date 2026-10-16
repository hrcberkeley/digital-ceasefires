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

  const canvas = h("canvas", { className: "signal-field", "aria-hidden": "true" });

  mountEl.appendChild(
    h("div", { className: "container" }, [
      h("section", { className: "hero" }, [
        canvas,
        h("h1", {}, lines.map((line) => h("span", {}, line))),
        h("p", { className: "hero-lede" }, t(db, "home.hero_subtitle", "A practical framework for mediators, negotiators, and affected communities to negotiate, draft, and implement ceasefire, de-escalation, and other agreements to constrain digital operations during conflict and other security contexts.")),
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
  signalField(canvas);
}

// Background traces, after the AFfacts contour canvas: stacked signal lines that drift, part around the
// cursor like a jamming field, and carry a few red "packets". Stops itself once the route unmounts it.
function signalField(canvas) {
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--color-ink").trim();
  const accent = css.getPropertyValue("--color-accent").trim();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GAP = 16;
  const mouse = { x: -1e4, y: -1e4 };
  const packets = Array.from({ length: 7 }, () => ({ row: Math.random(), x: Math.random(), v: 0.0004 + Math.random() * 0.0008 }));
  let w = 0, ht = 0;

  const size = () => {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    w = r.width; ht = r.height;
    canvas.width = w * d; canvas.height = ht * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
  };
  const lineY = (i, x, t) => {
    const base = i * GAP;
    let y = base + 5 * Math.sin(x * 0.004 + i * 0.35 + t * 0.0004) + 3 * Math.sin(x * 0.012 - i * 0.2 - t * 0.0003);
    const dx = x - mouse.x, dy = base - mouse.y;
    return y + Math.sign(dy || 1) * 30 * Math.exp(-(dx * dx + dy * dy) / 16000);
  };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  };
  addEventListener("pointermove", onMove);
  addEventListener("resize", size);

  const draw = (t) => {
    if (!canvas.isConnected) { removeEventListener("pointermove", onMove); removeEventListener("resize", size); return; }
    ctx.clearRect(0, 0, w, ht);
    const rows = Math.ceil(ht / GAP) + 2;
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.1; ctx.lineWidth = 1;
    for (let i = 0; i < rows; i++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, lineY(i, x, t));
      ctx.stroke();
    }
    ctx.strokeStyle = accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5;
    for (const p of packets) {
      if (!still) p.x = (p.x + p.v) % 1.1;
      const i = Math.floor(p.row * rows), x0 = p.x * w - 40;
      ctx.beginPath();
      for (let x = x0; x <= x0 + 40; x += 4) ctx.lineTo(x, lineY(i, x, t));
      ctx.stroke();
    }
    if (!still) requestAnimationFrame(draw);
  };
  size();
  requestAnimationFrame(draw);
}
