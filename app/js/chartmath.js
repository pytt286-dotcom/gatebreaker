// ============================================================================
// chartmath.js — pure chart helpers (no DOM), unit-tested in tests/calc.test.mjs.
// ============================================================================
import { parseKey, addDays, diffDays } from './calc.js';
const ms = (k) => parseKey(k).getTime();

/** Value of a line series at date k (straight line between its points), or null outside it. */
export function valueAt(pts, k) {
  if (!pts.length) return null;
  const t = ms(k);
  if (t < ms(pts[0].x) || t > ms(pts[pts.length - 1].x)) return null;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].x === k) return pts[i].y;
    if (i && ms(pts[i].x) > t) { const a = pts[i - 1], b = pts[i]; return a.y + (b.y - a.y) * (t - ms(a.x)) / (ms(b.x) - ms(a.x)); }
  }
  return null;
}

/** Nice round step so an axis gets about `n` labels (1, 2, 2.5, 5 × 10ⁿ). */
export function niceStep(span, n) {
  const raw = Math.max(span, 1e-9) / Math.max(1, n);
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/**
 * Calendar-aware date ticks that never overlap: days or weeks for short ranges,
 * month starts for months, years for long ranges. Labels always say enough
 * (the year appears whenever the range spans more than one year).
 */
export function timeTicks(k0, k1, px) {
  const days = Math.max(1, diffDays(k0, k1));
  const y0 = Number(k0.slice(0, 4)), y1 = Number(k1.slice(0, 4));
  const multiYear = y0 !== y1;
  const dayLabel = (k) => { const d = parseKey(k); return `${d.getDate()} ${MONS[d.getMonth()]}${multiYear ? ' ' + String(d.getFullYear()).slice(2) : ''}`; };
  const monLabel = (k, i) => { const d = parseKey(k); return d.getMonth() === 0 || i === 0 ? `${MONS[d.getMonth()]} ${d.getFullYear()}` : MONS[d.getMonth()]; };
  const fits = (count, chars) => count * (chars * 6.4 + 14) <= px;
  for (const step of [1, 2, 3, 7, 14]) {
    if (days / step > 40) continue;
    const ks = []; for (let k = k0; k <= k1; k = addDays(k, step)) ks.push(k);
    if (fits(ks.length, multiYear ? 9 : 6)) return ks.map((k) => ({ k, t: dayLabel(k) }));
  }
  for (const m of [1, 2, 3, 6, 12, 24, 60]) {
    const ks = [];
    const d = parseKey(k0); let y = d.getFullYear(), mo = d.getMonth();
    if (d.getDate() !== 1) mo++;
    mo = Math.ceil(mo / m) * m; // align (Jan/Apr/Jul/Oct for quarters, Jan for years)
    for (let guard = 0; guard < 400; guard++) {
      const yy = y + Math.floor(mo / 12), mm = ((mo % 12) + 12) % 12;
      const k = `${yy}-${String(mm + 1).padStart(2, '0')}-01`;
      if (k > k1) break;
      if (k >= k0) ks.push(k);
      mo += m;
    }
    if (!ks.length) continue;
    if (m >= 12) { if (fits(ks.length, 4)) return ks.map((k) => ({ k, t: k.slice(0, 4) })); continue; }
    if (fits(ks.length, 8)) return ks.map((k, i) => ({ k, t: monLabel(k, i) }));
  }
  return [{ k: k0, t: dayLabel(k0) }, { k: k1, t: dayLabel(k1) }];
}

