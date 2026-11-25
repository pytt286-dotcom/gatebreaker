// ============================================================================
// theme.js — colour themes. Clients get Rose by default if they chose Female
// at sign-up, Blue otherwise; anyone can change it in Profile (clients) or
// Settings (coach). The choice is saved on the client's profile so it follows
// them to every device; the coach's choice is saved on that device.
// ============================================================================
export const THEMES = [
  { id: 'blue', name: 'Blue', sw: 'linear-gradient(135deg,#4cc3ff,#1658e0)', bg: '#060a16' },
  { id: 'rose', name: 'Rose', sw: 'linear-gradient(135deg,#ff86c0,#b82a76)', bg: '#12060f' },
  { id: 'violet', name: 'Violet', sw: 'linear-gradient(135deg,#b89aff,#5a2fd6)', bg: '#090616' },
  { id: 'silver', name: 'Silver', sw: 'linear-gradient(135deg,#f2f5fa,#434f63)', bg: '#0a0b0f' },
];
const IDS = THEMES.map((t) => t.id);
export const isTheme = (t) => IDS.includes(t);
/** The theme a client should see: their own choice, else the default for their sex. */
export function themeFor(profile) {
  if (profile && isTheme(profile.theme)) return profile.theme;
  return profile && profile.sex === 'female' ? 'rose' : 'blue';
}
export function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'blue'; }
export function applyTheme(id) {
  if (!isTheme(id)) id = 'blue';
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== id) {
    root.setAttribute('data-theme', id);
  }
  const meta = document.querySelector('meta[name=theme-color]');
  const t = THEMES.find((x) => x.id === id);
  if (meta && t && meta.content !== t.bg) meta.content = t.bg;
  try { localStorage.setItem('pt-theme', id); } catch (e) { /* ignore */ }
}
export const coachTheme = () => { try { const t = localStorage.getItem('pt-theme-coach'); return isTheme(t) ? t : 'blue'; } catch (e) { return 'blue'; } };
export const setCoachTheme = (t) => { try { localStorage.setItem('pt-theme-coach', t); } catch (e) { /* ignore */ } applyTheme(t); };
/** Read a CSS colour variable (for charts drawn in SVG). */
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
