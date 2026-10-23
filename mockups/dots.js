// 4 · Dot matrix (experimental). The cover shown on a fixed LED grid: the chevron is an image passing
// across the grid, so dots switch colour as its tip drifts toward the pointer. Every dot sits on a spring:
// the pointer jams them (they scatter out of its way and settle back), a tap sends a pulse rippling out
// that knocks dots off their posts and flashes them. Faint signal dots on the navy light up under the
// pointer like a scanner. With nobody around, the tip pings a pulse every few seconds.
import { cover, heroCanvas, animate, still } from "./lib.js";

export default function dots(hero) {
  const { navy, bands } = cover();
  const S = bands.length + 1; // seams: the navy's edge, then the bottom of each band
  const waves = [];
  let G = 7, cols = 0, N = 0, hx, hy, x, y, vx, vy, heat, band, E;
  let W = 0, H = 0, tip = 0.62, nextPing = 2500;

  const seam = (s, px, t) => {
    const b = Math.max(G * 1.5, Math.min(16, H * 0.035)); // at least a row and a half of LEDs per band
    return H - (S - s) * b - 6 - (Math.abs(px - tip * W) / (0.85 * W)) * Math.min(H * 0.2, 110) +2.5 * Math.sin(px * 0.006 + s * 0.5 + t * 0.0005);
  };
  const pulse = (px, py, reach) => waves.push({ x: px, y: py, r: 0, reach });

  function frame(ctx, w, ht, t, p) {
    if (p.over) tip += (Math.min(0.88, Math.max(0.12, p.x / w)) - tip) * 0.03;
    for (let s = 0; s < S; s++) for (let c = 0; c < cols; c++) E[s * cols + c] = seam(s, c * G, t);
    if (!still && !p.over && t > nextPing) {
      const c = Math.round((tip * w) / G);
      pulse(c * G, E[(S - 1) * cols + c], 420);
      nextPing = t + 4500;
    }
    for (const wv of waves) wv.r += 7;
    while (waves.length && waves[0].r > waves[0].reach) waves.shift();

    const R = 70, reach = R * R;
    for (let i = 0; i < N; i++) {
      const c = i % cols;
      let k = -1;
      while (k + 1 < S && hy[i] >= E[(k + 1) * cols + c]) k++;
      band[i] = k;
      if (still) continue;
      let fx = (hx[i] - x[i]) * 0.045, fy = (hy[i] - y[i]) * 0.045;
      const dx = x[i] - p.x, dy = y[i] - p.y, d2 = dx * dx + dy * dy;
      if (d2 < reach) {
        const d = Math.sqrt(d2) + 0.01, f = (1 - d / R) ** 2 * 2.6;
        fx += (dx / d) * f; fy += (dy / d) * f;
      }
      for (const wv of waves) {
        const ex = x[i] - wv.x, ey = y[i] - wv.y, d = Math.hypot(ex, ey) + 0.01, off = Math.abs(d - wv.r);
        if (off < 16) {
          const life = 1 - wv.r / wv.reach, f = (1 - off / 16) * life;
          fx += (ex / d) * f * 3; fy += (ey / d) * f * 3;
          heat[i] = Math.max(heat[i], f);
        }
      }
      vx[i] = (vx[i] + fx) * 0.84; vy[i] = (vy[i] + fy) * 0.84;
      x[i] += vx[i]; y[i] += vy[i];
      heat[i] *= 0.94;
    }

    // navy panel down to the last seam; below it the page shows through
    ctx.clearRect(0, 0, w, ht);
    ctx.globalAlpha = 1; ctx.fillStyle = navy;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0);
    for (let c = cols - 1; c >= 0; c--) ctx.lineTo(c * G, E[(S - 1) * cols + c] + G / 2);
    ctx.closePath(); ctx.fill();

    // signal dots on the navy, lit under the pointer and by passing pulses
    ctx.fillStyle = bands[3];
    for (let py = 10; py < ht; py += 14) {
      for (let px = 6; px < w; px += 14) {
        if (py > E[Math.min(cols - 1, Math.round(px / G))] - 4) continue;
        let a = 0.1;
        const d = Math.hypot(px - p.x, py - p.y);
        if (d < 160) a += 0.5 * (1 - d / 160);
        for (const wv of waves) { const off = Math.abs(Math.hypot(px - wv.x, py - wv.y) - wv.r); if (off < 20) a += 0.5 * (1 - off / 20) * (1 - wv.r / wv.reach); }
        const r = 0.8 + a * 1.4;
        ctx.globalAlpha = Math.min(0.8, a);
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      }
    }

    // the LEDs: one path per band colour, then the flashes on top
    const r = G * 0.4;
    ctx.globalAlpha = 1;
    for (let k = 0; k < S - 1; k++) {
      ctx.fillStyle = bands[k];
      ctx.beginPath();
      for (let i = 0; i < N; i++) if (band[i] === k) { ctx.moveTo(x[i] + r, y[i]); ctx.arc(x[i], y[i], r, 0, 7); }
      ctx.fill();
    }
    ctx.fillStyle = "#fff";
    for (let i = 0; i < N; i++) {
      if (heat[i] < 0.05 || band[i] < 0 || band[i] >= S - 1) continue;
      ctx.globalAlpha = Math.min(1, heat[i] * 1.5);
      ctx.beginPath(); ctx.arc(x[i], y[i], r * (1 + heat[i] * 0.4), 0, 7); ctx.fill();
    }
  }

  animate(heroCanvas(hero), frame, {
    onResize(w, ht) {
      W = w; H = ht; G = w < 700 ? 8 : 7;
      cols = Math.ceil(w / G) + 1;
      const room = (parseFloat(getComputedStyle(hero).paddingBottom) || 160) + 30;
      const top = Math.max(0, ht - room), rows = Math.ceil((ht - top) / G);
      N = cols * rows;
      [hx, hy, x, y, vx, vy, heat] = Array.from({ length: 7 }, () => new Float32Array(N));
      band = new Int8Array(N);
      E = new Float32Array(S * cols);
      for (let i = 0; i < N; i++) {
        x[i] = hx[i] = (i % cols) * G;
        y[i] = hy[i] = top + Math.floor(i / cols) * G;
      }
    },
    onTap(px, py) { pulse(px, py, 700); },
  });
}
