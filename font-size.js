(() => {
  const KEY = 'ispovesti:font-size-level';
  const LEVELS = [1, 1.1, 1.2, 1.3, 1.4];
  let level = 0;

  try {
    const saved = parseInt(localStorage.getItem(KEY) || '0', 10);
    if (Number.isInteger(saved) && saved >= 0 && saved < LEVELS.length) level = saved;
  } catch (_) {}

  function applyFontScale() {
    const scale = String(LEVELS[level]);
    const targets = [
      document.querySelector('.site-header'),
      document.getElementById('main'),
      document.querySelector('body > footer'),
      document.getElementById('side-menu'),
      document.getElementById('dialog')
    ];
    targets.filter(Boolean).forEach((element) => {
      element.style.setProperty('zoom', scale, 'important');
    });

    const plus = document.getElementById('font-increase');
    const minus = document.getElementById('font-decrease');
    if (plus) {
      plus.disabled = level === LEVELS.length - 1;
      plus.setAttribute('aria-label', 'Povećaj slova' + (plus.disabled ? ' (maksimalna veličina)' : ''));
    }
    if (minus) {
      minus.disabled = level === 0;
      minus.setAttribute('aria-label', 'Smanji slova' + (minus.disabled ? ' (minimalna veličina)' : ''));
    }
    try { localStorage.setItem(KEY, String(level)); } catch (_) {}
  }

  // Delegation survives if another script rebuilds the controls.
  document.addEventListener('click', (event) => {
    const button = event.target.closest('#font-increase, #font-decrease');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.id === 'font-increase') level = Math.min(level + 1, LEVELS.length - 1);
    else level = Math.max(level - 1, 0);
    applyFontScale();
  }, true);

  applyFontScale();
})();
