// Perspective camera over a local km plane centred on the Taiwan Strait, with orbit / pan / zoom controls.
const RAD = Math.PI / 180;
export const CENTER = [120.3, 24.0];
const KX = 111.32 * Math.cos(CENTER[1] * RAD), KY = 110.57;
/** [lon, lat] -> local km [x east, y north]. */
export const toKm = ([lon, lat]) => [(lon - CENTER[0]) * KX, (lat - CENTER[1]) * KY];
export const toLonLat = (x, y) => [x / KX + CENTER[0], y / KY + CENTER[1]];

const EYE = 1500; // km from the target: sets the strength of perspective
export const DEFAULT_VIEW = { yaw: -14, pitch: 48, zoom: 0.95, tx: 20, ty: -45 };

export function createCamera(canvas, onChange) {
  const cam = { ...DEFAULT_VIEW, w: 1, h: 1, scale: 1, cy0: 0.56 };
  let cs, sn, cp, sp;
  cam.update = () => {
    cs = Math.cos(cam.yaw * RAD); sn = Math.sin(cam.yaw * RAD);
    cp = Math.cos(cam.pitch * RAD); sp = Math.sin(cam.pitch * RAD);
    // Fit roughly 1,050 km of the map across the shorter side at zoom 1.
    cam.scale = Math.min(cam.w, cam.h * 1.25) / 1000 * cam.zoom;
  };
  /** Project local km (x, y, z) to screen px. Returns [sx, sy, depth] (depth > 0 in front). */
  cam.project = (x, y, z = 0) => {
    const dx = x - cam.tx, dy = y - cam.ty;
    const x1 = dx * cs + dy * sn, y1 = -dx * sn + dy * cs;
    const depth = EYE + y1 * sp - z * cp;
    const up = y1 * cp + z * sp;
    const f = cam.scale * EYE / Math.max(depth, 50);
    return [cam.w / 2 + x1 * f, cam.h * cam.cy0 - up * f, depth];
  };
  cam.ll = (lon, lat, z = 0) => { const [x, y] = toKm([lon, lat]); return cam.project(x, y, z); };
  /** Screen px -> ground km (z = 0), by inverting the projection on the ground plane. */
  cam.unproject = (sx, sy) => {
    const X = (sx - cam.w / 2) / (cam.scale * EYE), U = (cam.h * cam.cy0 - sy) / (cam.scale * EYE);
    // up = y1 cp, depth = EYE + y1 sp; U = y1 cp / (EYE + y1 sp)  =>  y1 = U EYE / (cp - U sp)
    const den = cp - U * sp;
    if (den <= 1e-4) return null;
    const y1 = U * EYE / den, depth = EYE + y1 * sp, x1 = X * depth;
    return [x1 * cs - y1 * sn + cam.tx, x1 * sn + y1 * cs + cam.ty];
  };
  cam.set = v => { Object.assign(cam, v); clamp(); cam.update(); onChange(); };
  const clamp = () => {
    cam.pitch = Math.max(0, Math.min(68, cam.pitch));
    cam.zoom = Math.max(0.6, Math.min(5, cam.zoom));
    cam.yaw = ((cam.yaw + 540) % 360) - 180;
    cam.tx = Math.max(-520, Math.min(520, cam.tx)); cam.ty = Math.max(-460, Math.min(460, cam.ty));
  };
  cam.resize = (w, h) => { cam.w = w; cam.h = h; cam.cy0 = w < 560 ? 0.52 : 0.56; cam.update(); };

  // Pointer controls: drag = pan, shift/right/two-finger drag = orbit, wheel/pinch = zoom.
  const pts = new Map();
  let mode = null, last = null, pinch0 = null;
  const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, pos(e));
    if (pts.size === 2) { mode = 'pinch'; const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom: cam.zoom, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], yaw: cam.yaw, pitch: cam.pitch }; return; }
    mode = e.button === 2 || e.shiftKey || e.altKey ? 'orbit' : 'pan';
    last = pos(e);
    cam.dragging = true;
  });
  canvas.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const p = pos(e);
    pts.set(e.pointerId, p);
    if (mode === 'pinch' && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      cam.set({ zoom: pinch0.zoom * d / Math.max(20, pinch0.d), pitch: pinch0.pitch - (mid[1] - pinch0.mid[1]) * 0.25,
        yaw: pinch0.yaw + (mid[0] - pinch0.mid[0]) * 0.25 });
      return;
    }
    if (!last) return;
    const dx = p[0] - last[0], dy = p[1] - last[1];
    if (mode === 'orbit') cam.set({ yaw: cam.yaw + dx * 0.3, pitch: cam.pitch - dy * 0.25 });
    else {
      const g0 = cam.unproject(...last), g1 = cam.unproject(...p);
      if (g0 && g1) cam.set({ tx: cam.tx - (g1[0] - g0[0]), ty: cam.ty - (g1[1] - g0[1]) });
    }
    last = p;
  });
  const end = e => { pts.delete(e.pointerId); if (pts.size < 2 && mode === 'pinch') mode = null; if (!pts.size) { last = null; mode = null; cam.dragging = false; onChange(true); } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const p = pos(e), before = cam.unproject(...p);
    cam.set({ zoom: cam.zoom * Math.exp(-e.deltaY * 0.0015) });
    const after = cam.unproject(...p);
    if (before && after) cam.set({ tx: cam.tx + before[0] - after[0], ty: cam.ty + before[1] - after[1] });
  }, { passive: false });
  canvas.addEventListener('keydown', e => {
    const k = e.key, step = e.shiftKey ? 3 : 1;
    const m = { ArrowLeft: { yaw: cam.yaw - 6 * step }, ArrowRight: { yaw: cam.yaw + 6 * step }, ArrowUp: { pitch: cam.pitch + 4 * step },
      ArrowDown: { pitch: cam.pitch - 4 * step }, '+': { zoom: cam.zoom * 1.15 }, '=': { zoom: cam.zoom * 1.15 }, '-': { zoom: cam.zoom / 1.15 } }[k];
    if (m) { e.preventDefault(); cam.set(m); }
  });
  cam.update();
  return cam;
}
