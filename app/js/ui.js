// ============================================================================
// ui.js — small UI helpers: escaping, icons, sheets, dialogs, toasts, charts.
// ============================================================================
import { parseKey, dateKey, addDays, diffDays } from './calc.js';
import { cssVar } from './theme.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const P = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const I = {
  home: P('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  food: P('<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8 7c0-2 2-2 2-4M12 7c0-2 2-2 2-4M16 7c0-2 2-2 2-4"/>'),
  chart: P('<path d="M4 20V4"/><path d="M4 20h16"/><path d="M7 15l4-4 3 3 5-6"/>'),
  chat: P('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  notes: P('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.4"'),
  back: P('<path d="M15 18l-6-6 6-6"/>', 'stroke-width="2.2"'),
  left: P('<path d="M15 18l-6-6 6-6"/>', 'stroke-width="2.2"'),
  right: P('<path d="M9 6l6 6-6 6"/>', 'stroke-width="2.2"'),
  camera: P('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  check: P('<path d="M5 12l5 5L19 7"/>', 'stroke-width="2.6"'),
  x: P('<path d="M6 6l12 12M18 6L6 18"/>', 'stroke-width="2.2"'),
  trash: P('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  pin: P('<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>'),
  user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  users: P('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c.8-3.5 3.5-5 7-5s6.2 1.5 7 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.4 2.2 4 5"/>'),
  bell: P('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  send: P('<path d="M4 12l16-8-6 16-3-6z"/><path d="M11 14l9-10"/>'),
  image: P('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
  edit: P('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  inbox: P('<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>'),
  bolt: P('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  scale: P('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 9a6 6 0 0 1 8 0l-3 3"/>'),
  copy: P('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>'),
  out: P('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>'),
  megaphone: P('<path d="M3 10v4h4l8 5V5L7 10z"/><path d="M19 9a4 4 0 0 1 0 6"/>'),
  reply: P('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/>'),
  smile: P('<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>', 'stroke-width="2"'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  down: P('<path d="M6 9l6 6 6-6"/>', 'stroke-width="2.4"'),
  expand: P('<path d="M4 10V4h6M20 14v6h-6M4 4l6 6M20 20l-6-6"/>'),
  note: P('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 14l2 2 4-4"/>'),
};

// ---------- formatting ----------
export const fmtN = (n, dp = 0) => (n === null || n === undefined || !isFinite(n)) ? '–' : Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const fmtKg = (n) => (n === null || n === undefined || !isFinite(n)) ? '–' : `${fmtN(n, 1)} kg`;
export const signed = (n, dp = 1) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtN(Math.abs(n), dp);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function fmtDate(k, opts = {}) {
  if (!k) return '–';
  const d = parseKey(k), today = dateKey();
  if (opts.rel) {
    if (k === today) return 'Today';
    if (k === addDays(today, -1)) return 'Yesterday';
    if (k === addDays(today, 1)) return 'Tomorrow';
  }
  const s = `${opts.dow ? DOW[d.getDay()] + ' ' : ''}${d.getDate()} ${MON[d.getMonth()]}`;
  return opts.year || d.getFullYear() !== new Date().getFullYear() ? `${s} ${d.getFullYear()}` : s;
}
export const dowShort = (k) => DOW[parseKey(k).getDay()].slice(0, 2);
export function fmtTime(ms) { const d = new Date(ms); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
export function ago(ms) {
  if (!ms) return 'never';
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(dateKey(new Date(ms)));
}

// ---------- toasts ----------
export function toast(msg, bad = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; t.setAttribute('role', 'status');
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, bad ? 4200 : 2600);
}

// ---------- sheets / dialogs ----------
const openSheets = [];
export function sheet({ title, html, onMount, center = false, onClose }) {
  const ov = document.createElement('div');
  ov.className = 'ov' + (center ? ' center' : '');
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title || 'Dialog')}">
    ${center ? '' : '<div class="grab"></div>'}
    <div class="hd"><h2>${esc(title || '')}</h2><button class="iconbtn" data-x aria-label="Close">${I.x}</button></div>
    <div class="sb">${html}</div></div>`;
  $('#layer').appendChild(ov);
  document.body.style.overflow = 'hidden';
  let closed = false;
  const api = {
    el: ov.querySelector('.sb'), root: ov,
    close() {
      if (closed) return; closed = true; ov.remove();
      const i = openSheets.indexOf(api); if (i >= 0) openSheets.splice(i, 1);
      if (!openSheets.length) document.body.style.overflow = '';
      if (onClose) onClose();
    },
  };
  openSheets.push(api);
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-x]')) api.close(); });
  if (onMount) onMount(api.el, api);
  return api;
}
export const closeAllSheets = () => { while (openSheets.length) openSheets[openSheets.length - 1].close(); };
export const anySheetOpen = () => openSheets.length > 0;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openSheets.length) openSheets[openSheets.length - 1].close(); });

export function confirmBox(text, { ok = 'OK', danger = false, title = 'Confirm' } = {}) {
  return new Promise((res) => {
    let v = false;
    const s = sheet({
      title, center: true,
      html: `<p style="margin:0 0 16px">${esc(text)}</p><div class="grid2"><button class="btn ghost" data-no>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button></div>`,
      onMount: (el, api) => {
        el.querySelector('[data-no]').onclick = () => api.close();
        el.querySelector('[data-ok]').onclick = () => { v = true; api.close(); };
      },
      onClose: () => res(v),
    });
    return s;
  });
}

/**
 * Full-screen photo viewer. Pinch or double-tap to zoom, drag to move when
 * zoomed, swipe down (or ×, or Esc) to close.
 */
export function lightbox(src, { title = '', sub = '' } = {}) {
  const d = document.createElement('div');
  d.className = 'lightbox'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Photo');
  d.innerHTML = `<div class="lb-top"><span class="lb-cap">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><button class="iconbtn" data-close aria-label="Close photo">${I.x}</button></div>
    <div class="lb-stage"><img alt="${esc(title || 'Photo')}"></div><div class="lb-hint">Pinch or double-tap to zoom · swipe down to close</div>`;
  const img = d.querySelector('img'); img.src = src;
  document.body.appendChild(d);
  let s = 1, tx = 0, ty = 0;
  const pts = new Map(); let start = null, lastTap = 0, moved = false;
  const apply = () => { img.style.transform = `translate(${tx}px,${ty}px) scale(${s})`; };
  img.style.transformOrigin = 'center center';
  const close = () => { d.remove(); window.removeEventListener('keydown', key, true); };
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  window.addEventListener('keydown', key, true); // before the sheet's Esc handler, so only the photo closes
  d.querySelector('[data-close]').onclick = (e) => { e.stopPropagation(); close(); };
  const zoomAt = (ns, cx, cy) => { // keep the point under the finger still
    const r = img.getBoundingClientRect(); const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    ns = Math.max(1, Math.min(5, ns)); const k = ns / s;
    tx += (cx - ox) * (1 - k); ty += (cy - oy) * (1 - k); s = ns;
    if (s === 1) { tx = 0; ty = 0; }
    apply();
  };
  const stage = d.querySelector('.lb-stage');
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false;
    const a = [...pts.values()];
    start = { s, tx, ty, a: a.map((p) => ({ ...p })), dist: a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0 };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const a = [...pts.values()];
    if (a.length > 1 && start.a.length > 1) {
      const dist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      const mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
      s = start.s; tx = start.tx; ty = start.ty; zoomAt(start.s * dist / (start.dist || 1), mx, my); moved = true;
    } else if (a.length === 1) {
      const dx = a[0].x - start.a[0].x, dy = a[0].y - start.a[0].y;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (s > 1) { tx = start.tx + dx; ty = start.ty + dy; apply(); }
      else { ty = Math.max(0, dy); img.style.opacity = String(Math.max(.3, 1 - ty / 400)); apply(); }
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (s === 1 && ty > 110) return close();
    if (s === 1) { ty = 0; tx = 0; img.style.opacity = ''; apply(); }
    if (!moved && pts.size === 0) {
      const now = Date.now();
      if (now - lastTap < 320) { zoomAt(s > 1 ? 1 : 2.5, e.clientX, e.clientY); lastTap = 0; } else lastTap = now;
    }
    const a = [...pts.values()]; start = a.length ? { s, tx, ty, a: a.map((p) => ({ ...p })), dist: 0 } : null;
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY); }, { passive: false });
  setTimeout(() => d.querySelector('[data-close]').focus(), 30);
  return { close };
}

/** Big centred "System" window, e.g. calorie warnings and rank-ups. */
export function systemAlert({ tone = 'blue', title = 'Notification', big = '', text = '', btn = 'Understood', extraClass = '', bigHtml = '' }) {
  const d = document.createElement('div');
  d.className = 'sysalert ' + extraClass;
  const cls = tone === 'red' ? 'danger' : tone === 'amber' ? 'warn' : '';
  const col = tone === 'red' ? 'c-red' : tone === 'amber' ? 'c-amber' : 'c-blue';
  d.innerHTML = `<div class="win ${cls}" role="alertdialog" aria-label="${esc(title)}">
    <div class="ttl ${col}">[ ${esc(title)} ]</div>
    ${bigHtml || (big ? `<div class="big ${col}">${esc(big)}</div>` : '')}
    <p style="margin:8px 0 16px">${esc(text)}</p>
    <button class="btn primary block">${esc(btn)}</button></div>`;
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('button')) d.remove(); });
  document.body.appendChild(d);
  setTimeout(() => d.querySelector('button')?.focus(), 50);
}

export function rankBadge(id, size = '') {
  return `<span class="rankb ${size} rk-${esc(id)}" aria-label="Rank ${esc(id)}"><svg viewBox="0 0 52 52" aria-hidden="true">
    <polygon points="26,2 48,14 48,38 26,50 4,38 4,14" fill="rgba(4,10,24,.85)" stroke="currentColor" stroke-width="2"/>
    <polygon points="26,7 43.5,17 43.5,35 26,45 8.5,35 8.5,17" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1"/></svg>
    <b>${esc(id === 'N' ? 'N' : id)}</b></span>`;
}

// ---------- images ----------
/** Shrink a photo so it fits comfortably in the database (≈ 50–150 KB). */
export function compressImage(file, max = 900, q = 0.72) {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type || 'image/')) return rej(new Error('That file is not a photo.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let out = c.toDataURL('image/jpeg', q);
      if (out.length > 700000) out = c.toDataURL('image/jpeg', 0.5);
      res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that photo.')); };
    img.src = url;
  });
}

// ---------- charts ----------
const col = (c) => (c && c.startsWith('var(') ? cssVar(c.slice(4, -1)) || '#4cc3ff' : c);
const ms = (k) => parseKey(k).getTime();
/** Value of a line series at date k (straight line between its points), or null outside it. */
function valueAt(pts, k) {
  if (!pts.length) return null;
  const t = ms(k);
  if (t < ms(pts[0].x) || t > ms(pts[pts.length - 1].x)) return null;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].x === k) return pts[i].y;
    if (i && ms(pts[i].x) > t) { const a = pts[i - 1], b = pts[i]; return a.y + (b.y - a.y) * (t - ms(a.x)) / (ms(b.x) - ms(a.x)); }
  }
  return null;
}
/** Nice round step for axis ticks. */
function niceStep(span, n) { const raw = span / n; const p = 10 ** Math.floor(Math.log10(raw)); const m = raw / p; return (m >= 5 ? 10 : m >= 2 ? 5 : m >= 1 ? 2 : 1) * p; }
function dateTicks(k0, k1, maxN) {
  const days = Math.max(1, diffDays(k0, k1)); const step = Math.max(1, Math.ceil(days / maxN));
  const out = []; for (let k = k0; k <= k1; k = addDays(k, step)) out.push(k);
  return out;
}
/** Tooltip + crosshair shared by line and bar charts. */
function attachTip(el, svg, hit) {
  const clear = () => { const t = el.querySelector('.tip'); if (t) t.remove(); const g = svg.querySelector('.hl'); if (g) g.innerHTML = ''; };
  const show = (clientX) => {
    const r = el.getBoundingClientRect(); const x = clientX - r.left;
    const h = hit(x); if (!h) return clear();
    svg.querySelector('.hl').innerHTML = h.svg;
    let t = el.querySelector('.tip'); if (!t) { t = document.createElement('div'); t.className = 'tip'; t.setAttribute('role', 'status'); el.appendChild(t); }
    t.innerHTML = h.html;
    const w = t.offsetWidth; t.style.left = Math.max(w / 2, Math.min(r.width - w / 2, h.x)) + 'px'; t.style.top = (h.top ?? -6) - t.offsetHeight + 'px';
  };
  el.onpointerdown = (e) => { el._tipOn = true; show(e.clientX); };
  el.onpointermove = (e) => { if (el._tipOn || e.pointerType === 'mouse') show(e.clientX); };
  el.onpointerleave = (e) => { if (e.pointerType === 'mouse') { el._tipOn = false; clear(); } };
  el._tipClear = () => { el._tipOn = false; clear(); };
}
// tapping anywhere else hides an open chart readout
document.addEventListener('pointerdown', (e) => {
  for (const el of document.querySelectorAll('.chart')) if (el._tipOn && !el.contains(e.target) && el._tipClear) el._tipClear();
});

/**
 * Line chart with a tap/hover readout. series: [{pts:[{x:dateKey,y}], color, dash, dots, line, label}]
 * opts: goal (dashed target line), from/to (date range shown; default = all data), dp (decimals), unit.
 */
export function lineChart(el, series, { goal = null, from = null, to = null, dp = null, unit = '' } = {}) {
  const draw = () => {
    const W = el.clientWidth || 320, H = el.clientHeight || 200;
    const S = series.map((s) => ({ ...s, c: col(s.color), pts: [...s.pts].filter((p) => isFinite(p.y)).sort((a, b) => (a.x > b.x ? 1 : a.x < b.x ? -1 : 0)) }));
    const all = S.flatMap((s) => s.pts);
    if (!all.length) { el.innerHTML = '<div class="empty">No data yet</div>'; return; }
    let k0 = from || all.reduce((m, p) => (p.x < m ? p.x : m), all[0].x);
    let k1 = to || all.reduce((m, p) => (p.x > m ? p.x : m), all[0].x);
    if (k1 <= k0) k1 = addDays(k0, 1);
    const x0 = ms(k0), x1 = ms(k1);
    // y range from what is visible (points in range + lines where they cross the edges)
    const ys = [];
    for (const s of S) {
      for (const p of s.pts) if (p.x >= k0 && p.x <= k1) ys.push(p.y);
      if (s.line !== false) for (const k of [k0, k1]) { const v = valueAt(s.pts, k); if (v !== null) ys.push(v); }
    }
    if (goal !== null) ys.push(goal);
    if (!ys.length) { el.innerHTML = '<div class="empty">Nothing in this period. Pick a longer range.</div>'; return; }
    let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = Math.max(0.5, (y1 - y0) * 0.12); y0 -= pad; y1 += pad;
    const decimals = dp ?? ((y1 - y0) < 8 ? 1 : 0);
    const L = 40, R = 12, T = 14, B = 26;
    const X = (k) => L + ((ms(k) - x0) / (x1 - x0)) * (W - L - R);
    const Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    const grid = cssVar('--line2') || 'rgba(76,195,255,.22)';
    let g = `<defs><clipPath id="clip-${el.dataset.chart || 'c'}"><rect x="${L - 7}" y="0" width="${W - L - R + 14}" height="${H}"/></clipPath></defs>`;
    const step = niceStep(y1 - y0, 4);
    for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) {
      const y = Y(v);
      g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="${grid}" stroke-opacity=".5"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${fmtN(v, step < 1 ? 1 : 0)}</text>`;
    }
    if (goal !== null) g += `<line x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="#43e6a8" stroke-dasharray="2 4"/><text x="${L + 4}" y="${Y(goal) + 14}" style="fill:#43e6a8">goal ${fmtN(goal, 1)}</text>`;
    const ticks = dateTicks(k0, k1, Math.max(2, Math.floor((W - L - R) / 70)));
    ticks.forEach((k, i) => { const x = X(k); g += `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - B}" stroke="${grid}" stroke-opacity=".25"/><text x="${x}" y="${H - 7}" text-anchor="${i === 0 ? 'start' : 'middle'}">${esc(fmtDate(k))}</text>`; });
    const today = dateKey();
    if (today > k0 && today < k1) g += `<line x1="${X(today)}" x2="${X(today)}" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.3)" stroke-dasharray="3 3"/><text x="${X(today)}" y="${T - 3}" text-anchor="middle">today</text>`;
    g += `<g clip-path="url(#clip-${el.dataset.chart || 'c'})">`;
    for (const s of S) {
      if (!s.pts.length) continue;
      if (s.line !== false && s.pts.length > 1) g += `<polyline fill="none" stroke="${s.c}" stroke-width="2.2" stroke-linejoin="round" ${s.dash ? 'stroke-dasharray="6 5"' : ''} points="${s.pts.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')}"/>`;
      if (s.dots) for (const p of s.pts) if (p.x >= k0 && p.x <= k1) g += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5" fill="${s.c}" stroke="#000" stroke-opacity=".6" stroke-width="1.5"/>`;
    }
    g += '</g><g class="hl"></g>';
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chart. Tap to read values.">${g}</svg>`;
    // tap / hover readout: snaps to the nearest real data point (dots) if one is close, else reads the lines at that date
    const dotKeys = [...new Set(S.filter((s) => s.dots).flatMap((s) => s.pts.map((p) => p.x)).filter((k) => k >= k0 && k <= k1))];
    attachTip(el, el.querySelector('svg'), (px) => {
      if (px < L - 10 || px > W - R + 10) return null;
      const t = x0 + ((Math.max(L, Math.min(W - R, px)) - L) / (W - L - R)) * (x1 - x0);
      let k = dateKey(new Date(t));
      let best = null; for (const dk of dotKeys) { const dx = Math.abs(X(dk) - px); if (dx < 22 && (!best || dx < best.dx)) best = { k: dk, dx }; }
      if (best) k = best.k;
      const rows = []; let hl = `<line x1="${X(k)}" x2="${X(k)}" y1="${T}" y2="${H - B}" stroke="#fff" stroke-opacity=".55"/>`;
      let top = H;
      for (const s of S) {
        let v = null;
        if (s.dots) { const p = s.pts.filter((q) => q.x === k).pop(); if (p) v = p.y; }
        if (v === null && s.line !== false) v = valueAt(s.pts, k);
        if (v === null) continue;
        rows.push(`<div><i style="background:${s.c}"></i>${esc(s.label || '')}${s.label ? ': ' : ''}<b style="display:inline">${fmtN(v, decimals)}${unit ? ' ' + esc(unit) : ''}</b></div>`);
        hl += `<circle cx="${X(k)}" cy="${Y(v)}" r="5.5" fill="${s.c}" stroke="#fff" stroke-width="2"/>`;
        top = Math.min(top, Y(v));
      }
      if (!rows.length) return null;
      return { x: X(k), top: Math.max(0, top - 10), svg: hl, html: `<b>${esc(fmtDate(k, { dow: true, year: true }))}</b>${rows.join('')}` };
    });
  };
  draw();
  if (el._ro) el._ro.disconnect();
  let lastW = el.clientWidth;
  el._ro = new ResizeObserver(() => { if (el.clientWidth !== lastW) { lastW = el.clientWidth; draw(); } }); el._ro.observe(el);
}

/**
 * Daily calories bar chart. days: [{k, v (kcal), t (limit), st (status)}]. Tap a bar for the numbers.
 */
export function barChart(el, days, { statusText = {} } = {}) {
  const draw = () => {
    const W = el.clientWidth || 320, H = el.clientHeight || 170;
    if (!days.length) { el.innerHTML = '<div class="empty">No data yet</div>'; return; }
    const L = 40, R = 8, T = 12, B = 22;
    const maxV = Math.max(...days.map((d) => Math.max(d.v || 0, (d.t || 0) * 1.15)), 100);
    const step = niceStep(maxV, 4);
    const top = Math.ceil(maxV / step) * step;
    const n = days.length, bw = (W - L - R) / n;
    const Y = (v) => T + (1 - v / top) * (H - T - B);
    const grid = cssVar('--line2') || 'rgba(76,195,255,.22)';
    const colors = { cleared: '#43e6a8', over: '#ff4d6d', under: '#ffb547', progress: col('var(--acc)'), none: grid };
    let g = '';
    for (let v = 0; v <= top; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${grid}" stroke-opacity=".45"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${fmtN(v)}</text>`;
    days.forEach((d, i) => {
      const x = L + i * bw, w = Math.max(1, bw * (n > 40 ? 0.8 : 0.66));
      const h = Math.max(d.v ? 2 : 0, (H - T - B) * (d.v || 0) / top);
      g += `<rect x="${(x + (bw - w) / 2).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(3, w / 3)}" fill="${colors[d.st] || colors.none}"/>`;
    });
    // limit line (steps if the limit changed)
    let path = ''; days.forEach((d, i) => { if (!d.t) return; const x = L + i * bw, y = Y(d.t).toFixed(1); path += `${path ? 'L' : 'M'}${x.toFixed(1)},${y}L${(x + bw).toFixed(1)},${y}`; });
    if (path) g += `<path d="${path}" fill="none" stroke="#ffb547" stroke-dasharray="4 3" stroke-width="1.4"/>`;
    const every = Math.max(1, Math.ceil(n / Math.floor((W - L - R) / 44)));
    days.forEach((d, i) => { if ((n - 1 - i) % every === 0) g += `<text x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${n > 14 ? esc(fmtDate(d.k)) : Number(d.k.slice(8))}</text>`; });
    g += '<g class="hl"></g>';
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories per day. Tap a bar to read it.">${g}</svg>`;
    attachTip(el, el.querySelector('svg'), (px) => {
      const i = Math.floor((px - L) / bw); if (i < 0 || i >= n) return null;
      const d = days[i]; const x = L + i * bw + bw / 2;
      return {
        x, top: Math.min(Y(d.v || 0), d.t ? Y(d.t) : H) - 6,
        svg: `<rect x="${(L + i * bw).toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${H - T - B}" fill="#fff" fill-opacity=".08"/>`,
        html: `<b>${esc(fmtDate(d.k, { dow: true }))}</b><div>Eaten: <b style="display:inline">${d.v ? fmtN(d.v) + ' kcal' : 'nothing logged'}</b></div>${d.t ? `<div>Limit: ${fmtN(d.t)} kcal</div>` : ''}${statusText[d.st] ? `<div class="dim">${esc(statusText[d.st])}</div>` : ''}`,
      };
    });
  };
  draw();
  if (el._ro) el._ro.disconnect();
  let lastW = el.clientWidth;
  el._ro = new ResizeObserver(() => { if (el.clientWidth !== lastW) { lastW = el.clientWidth; draw(); } }); el._ro.observe(el);
}
