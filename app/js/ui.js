// ============================================================================
// ui.js — small UI helpers: escaping, icons, sheets, dialogs, toasts, charts.
// ============================================================================
import { parseKey, dateKey, addDays } from './calc.js';

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

export function lightbox(src) {
  const d = document.createElement('div');
  d.className = 'lightbox'; d.innerHTML = `<img alt="Photo">`;
  d.querySelector('img').src = src;
  d.onclick = () => d.remove();
  document.body.appendChild(d);
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
/**
 * Line chart. series: [{pts:[{x:dateKey,y}], color, dash, dots, label}]. Draws at real pixel size.
 */
export function lineChart(el, series, { goal = null, yUnit = '' } = {}) {
  const draw = () => {
    const W = el.clientWidth || 320, H = el.clientHeight || 200;
    const all = series.flatMap((s) => s.pts);
    if (!all.length) { el.innerHTML = '<div class="empty">No data yet</div>'; return; }
    const xs = all.map((p) => parseKey(p.x).getTime());
    let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x1 === x0) x1 = x0 + 86400000;
    const ys = all.map((p) => p.y).concat(goal !== null ? [goal] : []);
    let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = Math.max(0.5, (y1 - y0) * 0.12); y0 -= pad; y1 += pad;
    const L = 38, R = 10, T = 12, B = 24;
    const X = (k) => L + ((parseKey(k).getTime() - x0) / (x1 - x0)) * (W - L - R);
    const Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    let g = '';
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = y0 + ((y1 - y0) * i) / ticks, y = Y(v);
      g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="rgba(76,195,255,.1)"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${fmtN(v, (y1 - y0) < 8 ? 1 : 0)}</text>`;
    }
    if (goal !== null) g += `<line x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="#43e6a8" stroke-dasharray="2 4"/><text x="${L + 4}" y="${Y(goal) + 14}" style="fill:#43e6a8">goal ${fmtN(goal, 1)}</text>`;
    const k0 = dateKey(new Date(x0)), k1 = dateKey(new Date(x1));
    g += `<text x="${L}" y="${H - 6}">${esc(fmtDate(k0))}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${esc(fmtDate(k1))}</text>`;
    const today = dateKey();
    if (today > k0 && today < k1) g += `<line x1="${X(today)}" x2="${X(today)}" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.25)" stroke-dasharray="3 3"/><text x="${X(today)}" y="${T - 2}" text-anchor="middle">today</text>`;
    for (const s of series) {
      if (!s.pts.length) continue;
      const pts = [...s.pts].sort((a, b) => (a.x > b.x ? 1 : -1));
      if (s.line !== false && pts.length > 1) g += `<polyline fill="none" stroke="${s.color}" stroke-width="2.2" ${s.dash ? 'stroke-dasharray="6 5"' : ''} points="${pts.map((p) => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')}"/>`;
      if (s.dots) for (const p of pts) g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3.5" fill="${s.color}" stroke="#04060d" stroke-width="1.5"/>`;
    }
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chart">${g}</svg>`;
  };
  draw();
  if (el._ro) el._ro.disconnect();
  el._ro = new ResizeObserver(() => draw()); el._ro.observe(el);
}
