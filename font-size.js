(() => {
  'use strict';

  const STORAGE_KEY = 'ispovesti:font-size-level';
  const SCALES = [1, 1.1, 1.2, 1.3, 1.4];
  const SKIP = '#font-size-controls, #font-size-controls *, button, input, select, textarea, script, style, svg, path, template';
  const originalSizes = new WeakMap();
  let level = 0;

  try {
    const saved = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    if (Number.isInteger(saved) && saved >= 0 && saved < SCALES.length) level = saved;
  } catch (_) {}

  function hasOwnText(el) {
    if (!(el instanceof Element) || el.matches(SKIP)) return false;
    return Array.from(el.childNodes).some(node =>
      node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
    );
  }

  function remember(root) {
    const nodes = [];
    if (root instanceof Element && hasOwnText(root)) nodes.push(root);
    if (root && root.querySelectorAll) {
      root.querySelectorAll('*').forEach(el => {
        if (hasOwnText(el)) nodes.push(el);
      });
    }
    nodes.forEach(el => {
      if (!originalSizes.has(el)) {
        const computed = parseFloat(window.getComputedStyle(el).fontSize);
        if (Number.isFinite(computed)) {
          originalSizes.set(el, computed / SCALES[level]);
        }
      }
    });
  }

  function apply() {
    const scale = SCALES[level];
    remember(document.body);
    document.querySelectorAll('body *').forEach(el => {
      if (!hasOwnText(el)) return;
      const base = originalSizes.get(el);
      if (Number.isFinite(base)) {
        el.style.setProperty('font-size', (base * scale) + 'px', 'important');
      }
    });
    try { localStorage.setItem(STORAGE_KEY, String(level)); } catch (_) {}
    document.documentElement.setAttribute('data-font-scale', String(scale));
    const plus = document.getElementById('font-increase');
    const minus = document.getElementById('font-decrease');
    if (plus) plus.disabled = level >= SCALES.length - 1;
    if (minus) minus.disabled = level <= 0;
  }

  function init() {
    const plus = document.getElementById('font-increase');
    const minus = document.getElementById('font-decrease');

    if (plus) plus.addEventListener('click', event => {
      event.preventDefault();
      level = Math.min(level + 1, SCALES.length - 1);
      apply();
    });

    if (minus) minus.addEventListener('click', event => {
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