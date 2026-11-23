(() => {
  'use strict';
  const KEY = 'ispovesti:font-size-level';
  const LEVELS = [1, 1.1, 1.2, 1.3, 1.4];
  const BASE = 'data-isp-font-base';
  const SKIP = '#font-size-controls, #font-size-controls *, script, style, svg, path, symbol, template';
  let level = 0;
  try {
    const saved = parseInt(localStorage.getItem(KEY) || '0', 10);
    if (Number.isInteger(saved) && saved >= 0 && saved < LEVELS.length) level = saved;
  } catch (_) {}

  function isTextElement(el) {
    if (!(el instanceof Element) || el.matches(SKIP)) return false;
    if (/^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(el.tagName)) return true;
    return Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '');
  }
  function remember(el) {
    if (!isTextElement(el) || el.hasAttribute(BASE)) return;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (!Number.isFinite(size)) return;
    el.setAttribute(BASE, String(size / LEVELS[level]));
  }
  function scan(root = document.body) {
    if (root instanceof Element) remember(root);
    if (root && root.querySelectorAll) root.querySelectorAll('*').forEach(remember);
  }
  function apply() {
    scan();
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
  }
  function change(delta) {
    const next = Math.max(0, Math.min(LEVELS.length - 1, level + delta));
    if (next === level) return;
    level = next;
    apply();
  }
  function bind() {
    const plus = document.getElementById('font-increase');
    const minus = document.getElementById('font-decrease');
    if (plus) plus.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); change(1); }, true);
    if (minus) minus.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); change(-1); }, true);
    apply();
    const observer = new MutationObserver(records => {
      let added = false;
      for (const record of records) {
        if (record.type !== 'childList') continue;
        for (const node of record.addedNodes) {
          if (node instanceof Element) { scan(node); added = true; }
          else if (node.nodeType === Node.TEXT_NODE && node.parentElement) { remember(node.parentElement); added = true; }
        }
      }
      if (added) apply();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();