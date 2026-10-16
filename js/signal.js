// Background traces, after the AFfacts contour canvas: stacked signal lines that drift, part around the
// cursor like a jamming field, and carry a few red "packets". Used by the home hero, inner-page tops and
// the footer. Animates only while on screen; stops for good once its canvas leaves the DOM.
export function signalField(canvas, { alpha = 0.1, packets: count = 7 } = {}) {
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--color-ink").trim();
  const accent = css.getPropertyValue("--color-accent").trim();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GAP = 16;
  const mouse = { x: -1e4, y: -1e4 };
  const packets = Array.from({ length: count }, () => ({ row: Math.random(), x: Math.random(), v: 0.0004 + Math.random() * 0.0008 }));
  let w = 0, ht = 0, visible = false, queued = false;

  const lineY = (i, x, t) => {
    const base = i * GAP;
    const y = base + 5 * Math.sin(x * 0.004 + i * 0.35 + t * 0.0004) + 3 * Math.sin(x * 0.012 - i * 0.2 - t * 0.0003);
    const dx = x - mouse.x, dy = base - mouse.y;
    return y + Math.sign(dy || 1) * 30 * Math.exp(-(dx * dx + dy * dy) / 16000);
  };
  const stop = () => { removeEventListener("pointermove", onMove); resize.disconnect(); seen.disconnect(); };
  const onMove = (e) => {
    if (!canvas.isConnected) return stop(); // also catches canvases unmounted while paused off-screen
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
  const resize = new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    w = r.width; ht = r.height;
    canvas.width = w * d; canvas.height = ht * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    schedule();
  });
  const seen = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) schedule(); });

  function draw(t) {
    queued = false;
    if (!canvas.isConnected) return stop();
    ctx.clearRect(0, 0, w, ht);
    const rows = Math.ceil(ht / GAP) + 2;
    ctx.strokeStyle = ink; ctx.globalAlpha = alpha; ctx.lineWidth = 1;
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
    if (!still && visible) schedule();
  }

  addEventListener("pointermove", onMove);
  resize.observe(canvas);
  seen.observe(canvas);
}
