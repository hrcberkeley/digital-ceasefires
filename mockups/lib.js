// Shared plumbing for the hero mockups: the cover palette, and a canvas loop that sizes the canvas,
// tracks the pointer in canvas coordinates and redraws every frame while the canvas is on screen.
export const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function cover() {
  const css = getComputedStyle(document.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();
  return {
    navy: v("--cover-navy"),
    bands: ["--cover-blue", "--cover-teal", "--cover-sea", "--cover-cream", "--cover-peach", "--cover-orange", "--cover-red"].map(v),
  };
}

// Full-bleed canvas behind the hero's text (positioned by the site's .signal-field rules).
export function heroCanvas(hero) {
  const canvas = document.createElement("canvas");
  canvas.className = "signal-field chevron-field";
  canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);
  return canvas;
}

// frame(ctx, w, h, t, p): p = pointer { x, y, vx, vy, over } in canvas px; vx/vy are this frame's movement.
// onTap(x, y) fires for presses inside the canvas's vertical extent.
export function animate(canvas, frame, { onTap, onResize } = {}) {
  const ctx = canvas.getContext("2d");
  const p = { x: -1e4, y: -1e4, vx: 0, vy: 0, over: false };
  let w = 0, ht = 0, visible = false, queued = false;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r.height]; };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(tick); } };
  function tick(t) {
    queued = false;
    frame(ctx, w, ht, t, p);
    p.vx = p.vy = 0;
    if (!still && visible) schedule();
  }
  new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    w = r.width; ht = r.height;
    canvas.width = w * d; canvas.height = ht * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    onResize?.(w, ht);
    schedule();
  }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) schedule(); }).observe(canvas);
  addEventListener("pointermove", (e) => {
    const [x, y, h] = local(e);
    if (p.over) { p.vx += x - p.x; p.vy += y - p.y; }
    p.x = x; p.y = y; p.over = y >= 0 && y <= h;
  });
  addEventListener("pointerdown", (e) => {
    const [x, y, h] = local(e);
    if (onTap && y >= 0 && y <= h) { onTap(x, y); schedule(); }
  });
}
