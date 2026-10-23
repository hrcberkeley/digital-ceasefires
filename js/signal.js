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

// Home hero: the Handbook cover's chevron bands turned on their side. A navy field closed by
// horizontal bands meeting in a wide downward chevron; the point leans toward the cursor, bands
// bulge around it, light packets run along the seams, faint signal traces cross the navy.
export function chevronField(canvas) {
  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();
  const navy = v("--cover-navy");
  const bands = ["--cover-blue", "--cover-teal", "--cover-sea", "--cover-cream", "--cover-peach", "--cover-orange", "--cover-red"].map(v);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mouse = { x: -1e4, y: -1e4 };
  const packets = Array.from({ length: 6 }, (_, i) => ({ seam: i % bands.length, x: Math.random(), v: 0.0006 + Math.random() * 0.0009 }));
  let w = 0, ht = 0, tip = 0.62, visible = false, queued = false;

  // Lower edge of band i (i = -1 is the navy's edge). Thickness and rise scale with the hero.
  // The hero reserves its bottom padding for this, so the rise is capped to stay below the text.
  const edge = (i, x, t) => {
    const b = Math.max(7, Math.min(14, ht * 0.03));
    const base = ht - (bands.length - i) * b - 6;
    const rise = (Math.abs(x - tip * w) / (0.85 * w)) * Math.min(ht * 0.15, 90);
    const wave = 2.5 * Math.sin(x * 0.006 + i * 0.5 + t * 0.0005);
    const dx = x - mouse.x, dy = base - rise - mouse.y;
    return base - rise + wave + 12 * Math.exp(-(dx * dx + dy * dy) / 16000);
  };
  const path = (i, t, close) => {
    ctx.beginPath();
    for (let x = -10; x <= w + 10; x += 10) ctx.lineTo(x, edge(i, x, t));
    if (close) { ctx.lineTo(w + 10, ht + 10); ctx.lineTo(-10, ht + 10); ctx.closePath(); }
  };

  const stop = () => { removeEventListener("pointermove", onMove); resize.disconnect(); seen.disconnect(); };
  const onMove = (e) => {
    if (!canvas.isConnected) return stop();
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
    if (!still && mouse.y > 0 && mouse.y < ht) tip += (Math.min(0.85, Math.max(0.15, mouse.x / w)) - tip) * 0.04;
    ctx.clearRect(0, 0, w, ht);
    ctx.globalAlpha = 1;
    ctx.fillStyle = navy;
    ctx.fillRect(0, 0, w, ht); // the bands cover it from their edge down

    ctx.strokeStyle = bands[3]; ctx.globalAlpha = 0.05; ctx.lineWidth = 1;
    for (let y = 14; y < ht; y += 16) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const dx = x - mouse.x, dy = y - mouse.y;
        ctx.lineTo(x, y + 4 * Math.sin(x * 0.004 + y * 0.02 + t * 0.0004) + Math.sign(dy || 1) * 24 * Math.exp(-(dx * dx + dy * dy) / 16000));
      }
      ctx.stroke();
    }

    // each band casts a soft shadow up onto the one inside it, as on the cover
    ctx.globalAlpha = 1; ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = -2;
    bands.forEach((c, i) => { ctx.fillStyle = c; path(i - 1, t, true); ctx.fill(); });
    ctx.shadowColor = "transparent";
    // below the last band the page shows through
    ctx.globalCompositeOperation = "destination-out";
    path(bands.length - 1, t, true); ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    ctx.strokeStyle = "#fff"; ctx.globalAlpha = 0.8; ctx.lineWidth = 2; ctx.lineCap = "round";
    for (const p of packets) {
      if (!still) p.x = (p.x + p.v) % 1.1;
      const x0 = p.x * w - 50;
      ctx.beginPath();
      for (let x = x0; x <= x0 + 50; x += 5) ctx.lineTo(x, edge(p.seam - 1, x, t));
      ctx.stroke();
    }
    if (!still && visible) schedule();
  }

  addEventListener("pointermove", onMove);
  resize.observe(canvas);
  seen.observe(canvas);
}
