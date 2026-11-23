(() => {
  'use strict';
  const STORAGE_KEY = 'ispovesti:font-size-level';
  const LEVELS = [1, 1.1, 1.2, 1.3, 1.4];
  const EXCLUDED = '#font-size-controls, #font-size-controls *, script, style, svg, path, symbol, template';
  let level = 0;
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isInteger(saved) && saved >= 0 && saved < LEVELS.length) level = saved;
  } catch (_) {}

  const baseSizes = new WeakMap();
  function isTextElement(element) {
    if (!(element instanceof Element) || element.matches(EXCLUDED)) return false;
    if (/^(INPUT|TEXTAREA|SELECT|OPTION|BUTTON)$/.test(element.tagName)) return true;
    return Array.from(element.childNodes).some(
      child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()
    );
  }
  function collect(root) {
    const elements = [];
    if (root instanceof Element && isTextElement(root)) elements.push(root);
    if (root.querySelectorAll) root.querySelectorAll('*').forEach(el => {
      if (isTextElement(el)) elements.push(el);
    });
    const currentScale = LEVELS[level];
    elements.forEach(el => {
      if (!baseSizes.has(el)) {
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (Number.isFinite(size)) baseSizes.set(el, size / currentScale);
      }
    });
  }
  function apply() {
    const scale = LEVELS[level];
    collect(document.body);
    document.querySelectorAll('body *').forEach(el => {
      if (!isTextElement(el)) return;
      const base = baseSizes.get(el);
      if (Number.isFinite(base)) el.style.setProperty('font-size', (base * scale) + 'px', 'important');
    });
    const plus = document.getElementById('font-increase');
    const minus = document.getElementById('font-decrease');
    if (plus) plus.disabled = level === LEVELS.length - 1;
    if (minus) minus.disabled = level === 0;
    try { localStorage.setItem(STORAGE_KEY, String(level)); } catch (_) {}
    document.documentElement.dataset.fontScale = String(scale);
  }

  // Clear the earlier experiment that scaled whole page regions.
  ['.site-header', '#main', 'body > footer', '#side-menu', '#dialog'].forEach(selector => {
    document.querySelectorAll(selector).forEach(el => el.style.removeProperty('zoom'));
  });

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest('#font-increase, #font-decrease');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    level = button.id === 'font-increase'
      ? Math.min(level + 1, LEVELS.length - 1)
      : Math.max(level - 1, 0);
    apply();
  }, true);

  const observer = new MutationObserver(records => {
    let changed = false;
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) { collect(node); changed = true; }
    }));
    if (changed) apply();
  });

  if (document.body) {
    apply();
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      apply();
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  }
})();