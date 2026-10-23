// 2 · Pull (same energy, different feel). Direct manipulation instead of ambient reaction: grab the
// hero anywhere and drag, and the chevron's point comes with you, up, down or sideways. Each band
// follows on its own slightly looser spring, so the stack whips and fans out behind the point. Let go
// and the bands spring back with an overshoot and settle. Hovering only leans the point a little.
import { cover, heroCanvas, animate, still } from "./lib.js";

export default function pull(hero) {
  const { navy, bands } = cover();
  const S = bands.length + 1; // seams: the navy's edge, then the bottom of each band
  // per seam: point position (tx as a fraction of width, ty in px) and velocity
  const seams = Array.from({ length: S }, () => ({ tx: 0.62, ty: 0, vx: 0, vy: 0 }));
  let grab = null, W = 0, H = 0;

  const edge = (s, x, t) => {
    const b = Math.max(7, Math.min(14, H * 0.03)), q = seams[s];
    const reach = Math.max(0, 1 - Math.abs(x - q.tx * W) / (0.85 * W));
    const base = H - (S - s) * b - 6;
    return base - (1 - reach) * Math.min(H * 0.15, 90) + q.ty * reach + 2 * Math.sin(x * 0.006 + s * 0.5 + t * 0.0005);
  };

  function frame(ctx, w, ht, t, p) {
    W = w; H = ht;
    if (!still) {
      // target: the grab point while dragging, a slight lean toward a hovering pointer otherwise
      const gx = grab ? Math.min(0.95, Math.max(0.05, p.x / w)) : 0.62 + (p.over ? (p.x / w - 0.62) * 0.15 : 0);
      const gy = grab ? Math.max(-ht * 0.6, Math.min(ht * 0.25, p.y - grab.y)) : 0;
      seams.forEach((q, s) => {
        const k = 0.08 - s * 0.006, damp = grab ? 0.7 : 0.88; // outer seams are looser, so the stack fans
        q.vx = (q.vx + (gx - q.tx) * k) * damp; q.vy = (q.vy + (gy - q.ty) * k) * damp;
        q.tx += q.vx; q.ty += q.vy;
      });
    }
    ctx.globalAlpha = 1; ctx.fillStyle = navy; ctx.fillRect(0, 0, w, ht);

    // the navy's grain stretches toward the point while it's pulled
    const q0 = seams[0];
    ctx.strokeStyle = bands[3]; ctx.lineWidth = 1; ctx.globalAlpha = 0.05 + Math.min(0.08, Math.abs(q0.ty) / 2000);
    for (let y = 14; y < ht; y += 16) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const r = Math.max(0, 1 - Math.abs(x - q0.tx * w) / (0.6 * w));
        ctx.lineTo(x, y + 4 * Math.sin(x * 0.004 + y * 0.02 + t * 0.0004) + q0.ty * r * r * (y / ht));
      }
      ctx.stroke();
    }

    const path = (s, close) => {
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 8) ctx.lineTo(x, edge(s, x, t));
      if (close) { ctx.lineTo(w + 10, ht + 10); ctx.lineTo(-10, ht + 10); ctx.closePath(); }
    };
    ctx.globalAlpha = 1; ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = -2;
    bands.forEach((c, i) => { ctx.fillStyle = c; path(i, true); ctx.fill(); });
    ctx.shadowColor = "transparent";
    ctx.globalCompositeOperation = "destination-out";
    path(S - 1, true); ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // a grab handle at the point
    const tipX = q0.tx * w, tipY = edge(S - 1, tipX, t);
    ctx.globalAlpha = grab ? 0.95 : p.over ? 0.6 : 0.3;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(tipX, tipY - 3, grab ? 6 : 4, 0, 7); ctx.fill();
  }

  const canvas = heroCanvas(hero);
  hero.style.cursor = "grab";
  hero.style.touchAction = "pan-x"; // vertical drags pull the bands instead of scrolling the page
  animate(canvas, frame, { onTap(x, y) { grab = { y }; hero.style.cursor = "grabbing"; } });
  addEventListener("pointerup", () => { grab = null; hero.style.cursor = "grab"; });
  addEventListener("pointercancel", () => { grab = null; hero.style.cursor = "grab"; });
  hero.addEventListener("selectstart", (e) => grab && e.preventDefault());
}
