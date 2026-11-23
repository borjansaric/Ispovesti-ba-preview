(() => {
  const areas = ['.site-header', '#main', 'footer', '#side-menu', '#dialog'];
  const levels = [1, 1.1, 1.2, 1.3];
  let level = 0;

  try {
    const saved = Number(localStorage.getItem('ispovesti:font-size-level'));
    if (Number.isInteger(saved) && saved >= 0 && saved < levels.length) level = saved;
  } catch (_) {}

  function apply() {
    document.querySelectorAll(areas.join(',')).forEach((el) => {
      el.style.zoom = String(levels[level]);
    });

    const plus = document.getElementById('font-increase');
    const minus = document.getElementById('font-decrease');
    if (plus) plus.disabled = level === levels.length - 1;
    if (minus) minus.disabled = level === 0;

    try {
      localStorage.setItem('ispovesti:font-size-level', String(level));
    } catch (_) {}
  }

  const plus = document.getElementById('font-increase');
  const minus = document.getElementById('font-decrease');

  if (plus) plus.addEventListener('click', () => {
    level = Math.min(level + 1, levels.length - 1);
    apply();
  });

  if (minus) minus.addEventListener('click', () => {
    level = Math.max(level - 1, 0);
    apply();
  });

  apply();
})();
