// Runs before anything is drawn (plain script, not a module) so the saved
// colour theme shows from the first frame instead of flashing blue.
(function () {
  try {
    var t = localStorage.getItem('pt-theme');
    if (t && /^(blue|rose|violet|silver)$/.test(t)) document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage blocked: default theme */ }
})();
