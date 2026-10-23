// 2 · Lantern (same energy, different feel). The cover's chevron bands keep repeating up through the
// navy, too faint to see, and a soft light follows the pointer and shows them in full colour where it
// falls. Nothing to learn: moving is all it takes. When nobody's pointing, the light drifts on its own,
// so the pattern is visible from the first second (and on touch screens it follows the finger).
import { cover, heroCanvas, animate, still } from "./lib.js";

const TIP = 0.62;

export default function lantern(hero) {
  const { navy, bands } = cover();
  const layer = document.createElement("canvas"), lit = document.createElement("canvas");
  const lc = layer.getContext("2d"), kc = lit.getContext("2d");
  const light = { x: 0, y: 0 };
  let W = 0, H = 0, b = 10, rise = 60, lastSeen = -1e4;

  const seam = (i, x) => H - (bands.length - i) * b - 6 - (Math.abs(x - TIP * W) / (0.85 * W)) * rise;

  function frame(ctx, w, ht, t, p) {
    if (p.over) lastSeen = t;
    // follow the pointer; with nobody pointing, wander slowly across the field
    const auto = t - lastSeen > 1500 || still;
    const tx = auto ? w * (0.5 + 0.38 * Math.sin(t * 0.00023)) : p.x;
    const ty = auto ? ht * (0.4 + 0.18 * Math.sin(t * 0.00041)) : p.y;
    light.x += (tx - light.x) * (auto ? 0.03 : 0.14);
    light.y += (ty - light.y) * (auto ? 0.03 : 0.14);

    ctx.globalAlpha = 1; ctx.fillStyle = navy; ctx.fillRect(0, 0, w, ht);
    ctx.globalAlpha = 0.07; ctx.drawImage(layer, 0, 0, w, ht); // the pattern, barely there

    // the same pattern, cut to a soft disc around the light
    const r = Math.min(320, Math.max(160, w * 0.25));
    kc.globalCompositeOperation = "source-over";
    kc.clearRect(0, 0, w, ht);
    const g = kc.createRadialGradient(light.x, light.y, 0, light.x, light.y, r);
    g.addColorStop(0, "rgba(0,0,0,0.55)"); g.addColorStop(0.6, "rgba(0,0,0,0.3)"); g.addColorStop(1, "rgba(0,0,0,0)");
    kc.fillStyle = g; kc.fillRect(0, 0, w, ht);
    kc.globalCompositeOperation = "source-in";
    kc.drawImage(layer, 0, 0, w, ht);
    ctx.globalAlpha = 1; ctx.drawImage(lit, 0, 0, w, ht);

    // the cover's bands close the hero, brightening a touch where the light passes
    const path = (i) => {
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 10) {
        const dx = x - light.x;
        ctx.lineTo(x, seam(i, x) + 2.5 * Math.sin(x * 0.006 + i * 0.5 + t * 0.0005) - 6 * Math.exp(-(dx * dx) / 20000));
      }
      ctx.lineTo(w + 10, ht + 10); ctx.lineTo(-10, ht + 10); ctx.closePath();
    };
    ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = -2;
    bands.forEach((c, i) => { ctx.fillStyle = c; path(i - 1); ctx.fill(); });
    ctx.shadowColor = "transparent";
    ctx.globalCompositeOperation = "destination-out";
    path(bands.length - 1); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  animate(heroCanvas(hero), frame, {
    onResize(w, ht) {
      W = w; H = ht; light.x = w * 0.5; light.y = ht * 0.4;
      b = Math.max(7, Math.min(14, ht * 0.03));
      rise = Math.min(ht * 0.15, 90);
      const d = devicePixelRatio || 1;
      for (const c of [layer, lit]) { c.width = w * d; c.height = ht * d; }
      lc.setTransform(d, 0, 0, d, 0, 0); kc.setTransform(d, 0, 0, d, 0, 0);
      // the bands continue up through the navy, hidden: the same chevron and colours, repeating
      for (let k = 0; seam(-1, TIP * w) - k * b > -b; k++) {
        lc.fillStyle = bands[bands.length - 1 - (k % bands.length)];
        lc.beginPath();
        for (const x of [-20, TIP * w, w + 20]) lc.lineTo(x, seam(-1, x) - k * b);
        for (const x of [w + 20, TIP * w, -20]) lc.lineTo(x, seam(-1, x) - (k + 1) * b);
        lc.fill();
      }
    },
  });
}
