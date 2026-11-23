(() => {
  'use strict';

  const KEY = 'ispovesti:font-size-level';
  const SCALES = [1, 1.1, 1.2, 1.3, 1.4];
  const EXCLUDED = '#font-size-controls, #font-size-controls *, script, style, svg, path, symbol, template';
  const baseSizes = new WeakMap();
  let level = 0;

  try {
    const saved = parseInt(localStorage.getItem(KEY) || '0', 10);
    if (Number.isInteger(saved) && saved >= 0 && saved < SCALES.length) level = saved;
  } catch (_) {}

  function hasText(el) {
    if (!(el instanceof Element) || el.matches(EXCLUDED)) return false;
    return /^(BUTTON|INPUT|TEXTAREA|SELECT|OPTION)$/.test(el.tagName) ||
      Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  }

  function remember(root, isInitial = false) {
    const list = [];
    if (root instanceof Element && hasText(root)) list.push(root);
    if (root && root.querySelectorAll) {
      root.querySelectorAll('*').forEach(el => { if (hasText(el)) list.push(el); });
    }
    list.forEach(el => {
      if (baseSizes.has(el)) return;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (Number.isFinite(size)) {
        // On a fresh page load, CSS has not yet been scaled. Never divide
        // those original sizes by the saved preference.
        baseSizes.set(el, size);
      }
    });
  }

  function apply() {
    remember(document.body, true);
    const scale = SCALES[level];
    document.querySelectorAll('body *').forEach(el => {
      if (!hasText(el)) return;
      const base = baseSizes.get(el);
      if (Number.isFinite(base)) {
        el.style.setProperty('font-size', (base * scale) + 'px', 'important');
      }
    });
    try { localStorage.setItem(KEY, String(level)); } catch (_) {}
    const plus = document.getElementById('font-increase');
    const minus = document.getElementById('font-decrease');
    if (plus) plus.disabled = level === SCALES.length - 1;
    if (minus) minus.disabled = level === 0;
  }

  function init() {
    const plus = document.getElementById('font-increase');
    const minus = document.getElementById('font-decrease');

    plus?.addEventListener('click', event => {
      event.preventDefault();
      level = Math.min(level + 1, SCALES.length - 1);
      apply();
    });
    minus?.addEventListener('click', event => {
      event.preventDefault();
      level = Math.max(level - 1, 0);
      apply();
    });

    apply();

    const observer = new MutationObserver(records => {
      let added = false;
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node instanceof Element) {
          remember(node);
          added = true;
        }
      }));
      if (added) apply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();