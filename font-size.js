(() => {
  'use strict';

  const KEY = 'ispovesti:font-size-level';
  const SCALES = [1, 1.1, 1.2, 1.3, 1.4];
  const EXCLUDED = '#font-size-controls, #font-size-controls *, script, style, svg, path, symbol, template';
  const baseSizes = new WeakMap();
  let level = 0;
  let initialized = false;

  try {
    const saved = Number.parseInt(localStorage.getItem(KEY) || '0', 10);
    if (Number.isInteger(saved) && saved >= 0 && saved < SCALES.length) level = saved;
  } catch (_) {}

  function hasText(el) {
    if (!(el instanceof Element) || el.matches(EXCLUDED)) return false;
    if (/^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(el.tagName)) return true;
    return Array.from(el.childNodes).some(node =>
      node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
    );
  }

  function collect(root, initial = false) {
    const elements = [];
    if (root instanceof Element && hasText(root)) elements.push(root);
    if (root && root.querySelectorAll) {
      root.querySelectorAll('*').forEach(el => {
        if (hasText(el)) elements.push(el);
      });
    }
    const currentScale = SCALES[level];
    elements.forEach(el => {
      if (baseSizes.has(el)) return;
      const computed = Number.parseFloat(getComputedStyle(el).fontSize);
      if (!Number.isFinite(computed)) return;
      // New content may inherit a font size already scaled on its parent.
      baseSizes.set(el, initial || !initialized ? computed : computed / currentScale);
    });
  }

  function apply() {
    collect(document.body, !initialized);
    initialized = true;
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

  function changeLevel(direction) {
    const next = Math.max(0, Math.min(SCALES.length - 1, level + direction));
    if (next === level) return;
    level = next;
    apply();
  }

  // Delegate at document level so the controls work even if another script
  // later changes or re-renders nearby markup.
  document.addEventListener('click', event => {
    const button = event.target instanceof Element
      ? event.target.closest('#font-increase, #font-decrease')
      : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    changeLevel(button.id === 'font-increase' ? 1 : -1);
  }, true);

  function start() {
    apply();
    const observer = new MutationObserver(records => {
      let changed = false;
      records.forEach(record => {
        if (record.type === 'childList') {
          record.addedNodes.forEach(node => {
            if (node instanceof Element) {
              collect(node);
              changed = true;
            } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
              collect(node.parentElement);
              changed = true;
            }
          });
        } else if (record.type === 'characterData' && record.target.parentElement) {
          collect(record.target.parentElement);
          changed = true;
        }
      });
      if (changed) apply();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();