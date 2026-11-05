// Runs before styles load so a remembered choice is applied before first paint.
(() => {
  let preference;
  try { preference = localStorage.getItem('lastrep-site-appearance'); } catch { /* System is the fallback when storage is unavailable. */ }
  if (preference === 'light' || preference === 'dark') document.documentElement.dataset.appearance = preference;
})();
