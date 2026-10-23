// 3 · Tension (wilder). Pointer speed escalates the whole hero: the bands swell, climb into a sharper V and
// churn, heat blooms in the navy around the pointer, the traces go jagged, packets multiply and run hot,
// and the title's middle line warms toward red. Hold still and it all de-escalates back to the calm cover.
// A tap is a sudden escalation. A small readout names the state.
import { cover, heroCanvas, animate, still } from "./lib.js";

const css = `
.tension-readout {
  display: block; margin-top: 1.1em; font: 600 0.72rem/1.5 var(--font-mono); letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--cover-cream);
}
.tension-readout b { font-weight: 600; color: #fff; margin-right: 0.8em; }
`;

export default function tension(hero) {
  document.head.append(Object.assign(document.createElement("style"), { textContent: css }));
  const { navy, bands } = cover();
  const readout = document.createElement("span");
  readout.className = "tension-readout";
  readout.setAttribute("aria-hidden", "true");
  hero.querySelector(".hero-lede").append(readout);
  const middle = hero.querySelector("h1 span:nth-child(2)");

  let T = 0, Ts = 0, tip = 0.62, W = 0, H = 0, room = 160, shown = "";
  const packets = Array.from({ length: 28 }, (_, i) => ({ seam: i % bands.length, x: Math.random(), v: 0.0006 + Math.random() * 0.0009 }));

  // lower edge of band i (i = -1 is the navy's edge); everything scales with the smoothed tension Ts
  const edge = (i, x, t, p) => {
    const b = Math.min(Math.max(7, Math.min(14, H * 0.03)) * (1 + Ts * 0.7), Math.max(7, (room - 40) / 7)); // swell, but stay under the text
    const base = H - (bands.length - i) * b - 6;
    const maxRise = Math.max(20, room - bands.length * b - 26);
    const rise = (Math.abs(x - tip * W) / (0.85 * W)) * Math.min(Math.min(H * 0.15, 90) * (1 + Ts * 1.2), maxRise);
    const sp = 1 + Ts * 5;
    const wave = (2.5 + Ts * 8) * Math.sin(x * 0.006 + i * 0.5 + t * 0.0005 * sp)
      + Ts * 6 * Math.sin(x * 0.021 - i * 0.9 + t * 0.002 * sp)
      + Ts * Ts * 5 * Math.sin(x * 0.053 + i * 1.7 - t * 0.006);
    const dx = x - p.x, dy = base - rise - p.y;
    return base - rise + wave + (12 + Ts * 22) * Math.exp(-(dx * dx + dy * dy) / (16000 + Ts * 20000));
  };

  function frame(ctx, w, ht, t, p) {
    W = w; H = ht;
    if (!still) {
      T = Math.min(1, Math.max(0, T * 0.993 - 0.0012 + Math.hypot(p.vx, p.vy) * 0.0011));
      Ts += (T - Ts) * 0.06;
      if (p.over) tip += (Math.min(0.88, Math.max(0.12, p.x / w)) - tip) * (0.05 + Ts * 0.1);
    }
    ctx.globalAlpha = 1; ctx.fillStyle = navy; ctx.fillRect(0, 0, w, ht);

    // heat around the pointer
    if (Ts > 0.01 && p.over) {
      const r = 180 + Ts * 320, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, bands[5]); g.addColorStop(0.5, bands[6]); g.addColorStop(1, "transparent");
      ctx.globalAlpha = Ts * 0.4; ctx.fillStyle = g; ctx.fillRect(0, 0, w, ht);
    }

    // traces: calm and faint at rest, jagged and warm under tension
    ctx.strokeStyle = Ts > 0.5 ? bands[4] : bands[3]; ctx.lineWidth = 1; ctx.globalAlpha = 0.05 + Ts * 0.09;
    for (let y = 14; y < ht; y += 16) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const dx = x - p.x, dy = y - p.y;
        ctx.lineTo(x, y + (4 + Ts * 5) * Math.sin(x * 0.004 + y * 0.02 + t * 0.0004 * (1 + Ts * 6))
          + Ts * 3 * Math.sin(x * 0.09 + y + t * 0.01)
          + Math.sign(dy || 1) * (24 + Ts * 30) * Math.exp(-(dx * dx + dy * dy) / 16000));
      }
      ctx.stroke();
    }

    const path = (i, close) => {
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 8) ctx.lineTo(x, edge(i, x, t, p));
      if (close) { ctx.lineTo(w + 10, ht + 10); ctx.lineTo(-10, ht + 10); ctx.closePath(); }
    };
    ctx.globalAlpha = 1; ctx.shadowColor = `rgba(0,0,0,${0.22 + Ts * 0.2})`; ctx.shadowBlur = 8 + Ts * 10; ctx.shadowOffsetY = -2;
    bands.forEach((c, i) => { ctx.fillStyle = c; path(i - 1, true); ctx.fill(); });
    ctx.shadowColor = "transparent";
    ctx.globalCompositeOperation = "destination-out";
    path(bands.length - 1, true); ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    const live = 5 + Math.round(Ts * (packets.length - 5)), len = 50 + Ts * 70;
    ctx.lineWidth = 2 + Ts * 1.5; ctx.lineCap = "round";
    packets.slice(0, live).forEach((pk, k) => {
      if (!still) pk.x = (pk.x + pk.v * (1 + Ts * 5)) % 1.15;
      ctx.strokeStyle = Ts > 0.35 && k % 2 ? bands[6] : "#fff"; ctx.globalAlpha = 0.8;
      const x0 = pk.x * w - len;
      ctx.beginPath();
      for (let x = x0; x <= x0 + len; x += 5) ctx.lineTo(x, edge(pk.seam - 1, x, t, p));
      ctx.stroke();
    });

    middle.style.color = `color-mix(in srgb, var(--cover-peach), var(--cover-red) ${Math.round(Ts * 100)}%)`;
    // Ts lags T, so T < Ts means the field is cooling
    const state = T < 0.04 ? "Ceasefire holding" : T < Ts ? "De-escalating" : T > 0.6 ? "Escalating" : "Tension rising";
    const bars = Math.round(T * 12), html = `<b>${state}</b>${"▮".repeat(bars)}${"▯".repeat(12 - bars)}`;
    if (html !== shown) readout.innerHTML = shown = html;
  }

  animate(heroCanvas(hero), frame, {
    onResize() { room = parseFloat(getComputedStyle(hero).paddingBottom) || 160; },
    onTap() { T = Math.min(1, T + 0.35); },
  });
}
