// LIBRA reader gesture repair, layered onto the exact published application.
(() => {
  const exitingStyle = document.createElement('style');
  exitingStyle.dataset.libraTouchRepair = 'true';
  exitingStyle.textContent = '.reading-root .sheet-scrim.sheet-exiting{pointer-events:none!important}';
  document.head.appendChild(exitingStyle);
  const active = () => document.querySelector('.reading-root');
  let gesture = null, timer = null, suppressUntil = 0;
  const cancelHold = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  const selectButton = root => [...root.querySelectorAll('.reading-tools button')].find(button => button.textContent.trim() === 'Цитата');
  function contentAt(root, x, y) {
    const zones = root.querySelector('.reading-zones'), content = root.querySelector('.reading-content');
    if (!zones || !content) return null;
    const z = zones.style.pointerEvents, c = content.style.pointerEvents;
    try {
      zones.style.pointerEvents = 'none'; content.style.pointerEvents = 'auto';
      let element = document.elementFromPoint(x, y);
      if (element?.tagName === 'IFRAME') {
        const box = element.getBoundingClientRect();
        element = element.contentDocument?.elementFromPoint(x - box.left, y - box.top);
      }
      return element;
    } catch { return null; }
    finally { zones.style.pointerEvents = z; content.style.pointerEvents = c; }
  }
  function wordAt(root, x, y) {
    let doc = document, container = root.querySelector('.reading-content'), px = x, py = y;
    for (const frame of root.querySelectorAll('.epub-mount iframe')) {
      const box = frame.getBoundingClientRect();
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;
      try { if (frame.contentDocument?.body) { doc = frame.contentDocument; container = doc.body; px -= box.left; py -= box.top; break; } } catch {}
    }
    const range = doc.caretRangeFromPoint?.(px, py);
    const caret = range ? {offsetNode: range.startContainer, offset: range.startOffset} : doc.caretPositionFromPoint?.(px, py);
    const node = caret?.offsetNode;
    if (!node || node.nodeType !== 3 || !container?.contains(node)) return false;
    const text = node.textContent || '';
    const letter = value => /[\p{L}\p{N}'’\u002d]/u.test(value || '');
    let start = Math.min(caret.offset, text.length), end = start;
    if (!letter(text[start]) && start > 0 && letter(text[start - 1])) start--;
    end = start;
    while (start > 0 && letter(text[start - 1])) start--;
    while (end < text.length && letter(text[end])) end++;
    if (end <= start) return false;
    const selected = doc.createRange(); selected.setStart(node, start); selected.setEnd(node, end);
    const selection = doc.getSelection(); if (!selection) return false;
    selection.removeAllRanges(); selection.addRange(selected);
    window.dispatchEvent(new Event('libra-quote-selection'));
    return true;
  }
  function enterSelection(root, point) {
    const button = selectButton(root); if (!button) return;
    button.click();
    let attempts = 0;
    const choose = () => {
      if (active() !== root) return;
      if (!root.classList.contains('reading-quote-mode') && ++attempts < 5) { requestAnimationFrame(choose); return; }
      wordAt(root, point.x, point.y);
    };
    requestAnimationFrame(choose);
  }
  document.addEventListener('touchstart', event => {
    cancelHold(); gesture = null;
    const root = active(), target = event.target;
    if (!root || root.classList.contains('reading-modal-open') || !target?.closest?.('.reading-zones') || event.touches.length !== 1) return;
    const touch = event.touches[0];
    gesture = {root, x: touch.clientX, y: touch.clientY, held: false, moved: false};
    const point = gesture;
    if (!root.querySelector('.sheet-scrim:not(.sheet-exiting) .reading-sheet') && !contentAt(root, point.x, point.y)?.closest?.('img,svg,a,button,[role="button"]')) {
      timer = setTimeout(() => {
        timer = null;
        if (gesture !== point || active() !== root) return;
        point.held = true; suppressUntil = Date.now() + 900;
        enterSelection(root, point);
      }, 450);
    }
  }, {capture: true, passive: true});
  document.addEventListener('touchmove', event => {
    if (!gesture) return;
    if (event.touches.length !== 1) { cancelHold(); gesture = null; return; }
    const point = event.touches[0];
    if (Math.abs(point.clientX - gesture.x) > 10 || Math.abs(point.clientY - gesture.y) > 10) { gesture.moved = true; cancelHold(); }
  }, {capture: true, passive: true});
  document.addEventListener('touchcancel', () => { cancelHold(); gesture = null; suppressUntil = Date.now() + 900; }, {capture: true, passive: true});
  document.addEventListener('touchend', event => {
    cancelHold();
    const point = gesture; gesture = null;
    if (!point || active() !== point.root || !event.changedTouches.length) return;
    if (point.held) {
      suppressUntil = Date.now() + 900; event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    const end = event.changedTouches[0], root = point.root;
    if (point.moved || Math.abs(end.clientX - point.x) > 10 || Math.abs(end.clientY - point.y) > 10) return;
    const zones = root.querySelector('.reading-zones'), box = zones?.getBoundingClientRect();
    if (!box || !box.width) return;
    const ratio = (end.clientX - box.left) / box.width;
    if (ratio < .28 || ratio > .72) return;
    const hit = contentAt(root, end.clientX, end.clientY);
    if (hit?.closest?.('img,svg,a,button,[role="button"]')) return;
    suppressUntil = Date.now() + 900;
    event.preventDefault(); event.stopImmediatePropagation();
    const close = root.querySelector('.sheet-scrim:not(.sheet-exiting) .reading-sheet [aria-label="Закрыть"]');
    if (close) close.click(); else root.querySelector('.reading-status')?.click();
  }, {capture: true, passive: false});
  document.addEventListener('click', event => {
    if (Date.now() < suppressUntil && event.target?.closest?.('.reading-zones')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  function followSelection() {
    const root = active(); if (!root || root.classList.contains('reading-quote-mode') || root.classList.contains('reading-modal-open')) return;
    const content = root.querySelector('.reading-content');
    const inReader = selection => selection && !selection.isCollapsed && selection.rangeCount && selection.toString().trim().length >= 2;
    let selection = document.getSelection();
    if (inReader(selection) && content?.contains(selection.anchorNode) && content.contains(selection.focusNode)) { selectButton(root)?.click(); return; }
    for (const frame of root.querySelectorAll('.epub-mount iframe')) {
      try { selection = frame.contentDocument?.getSelection(); if (inReader(selection)) { selectButton(root)?.click(); return; } } catch {}
    }
  }
  document.addEventListener('selectionchange', followSelection);
  window.addEventListener('libra-quote-selection', followSelection);
  window.addEventListener('pagehide', () => { cancelHold(); gesture = null; });
})();