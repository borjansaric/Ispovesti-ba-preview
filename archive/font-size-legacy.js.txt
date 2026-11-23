(() => {
  'use strict';
  const KEY = 'ispovesti:font-size-level-v2';
  const LEVELS = [1, 1.1, 1.2, 1.3, 1.4];
  const BASE = 'data-isp-font-base';
  const SKIP = '#font-size-controls, #font-size-controls *, script, style, svg, path, symbol, template';
  let level = 0;
  let initialized = false;
  try {
    const saved = parseInt(localStorage.getItem(KEY) || '0', 10);
    if (Number.isInteger(saved) && saved >= 0 && saved < LEVELS.length) level = saved;
  } catch (_) {}

  function isTextElement(el) {
    if (!(el instanceof Element) || el.matches(SKIP)) return false;
    if (/^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(el.tagName)) return true;
    return Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '');
  }
  function remember(el, compensateForCurrentScale = false) {
    if (!isTextElement(el) || el.hasAttribute(BASE)) return;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (!Number.isFinite(size)) return;
    el.setAttribute(BASE, String(compensateForCurrentScale ? size / LEVELS[level] : size));
  }
  function scan(root = document.body, compensateForCurrentScale = false) {
    if (root instanceof Element) remember(root, compensateForCurrentScale);
    if (root && root.querySelectorAll) root.querySelectorAll('*').forEach(el => remember(el, compensateForCurrentScale));
  }
  function apply() {
    scan(document.body, initialized);
    const factor = LEVELS[level];
    document.querySelectorAll('body *').forEach(el => {
      if (!isTextElement(el)) return;
      const baseline = parseFloat(el.getAttribute(BASE));
      if (Number.isFinite(baseline)) el.style.setProperty('font-size', (baseline * factor) + 'px', 'important');
    });
    try { localStorage.setItem(KEY, String(level)); } catch (_) {}
    const plus = document.getElementById('font-increase');
    const minus = document.getElementById('font-decrease');
    if (plus) { plus.disabled = false; plus.title = 'Povećaj slova · trenutno ' + Math.round(factor * 100) + '%'; }
    if (minus) { minus.disabled = false; minus.title = 'Smanji slova · trenutno ' + Math.round(factor * 100) + '%'; }
    document.documentElement.setAttribute('data-isp-font-level', String(level));
    initialized = true;
  }
  function change(delta) {
    const next = Math.max(0, Math.min(LEVELS.length - 1, level + delta));
    if (next === level) return;
    level = next;
    apply();
  }
  function bind() {
    document.addEventListener('click', event => {
      const control = event.target instanceof Element ? event.target.closest('#font-increase, #font-decrease') : null;
      if (!control) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      change(control.id === 'font-increase' ? 1 : -1);
    }, true);
    apply();
    const observer = new MutationObserver(records => {
      let added = false;
      for (const record of records) {
        if (record.type !== 'childList') continue;
        for (const node of record.addedNodes) {
          if (node instanceof Element) { scan(node, true); added = true; }
          else if (node.nodeType === Node.TEXT_NODE && node.parentElement) { remember(node.parentElement, true); added = true; }
        }
      }
      if (added) apply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();