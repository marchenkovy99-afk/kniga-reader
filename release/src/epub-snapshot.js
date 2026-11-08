// Generated from libra/src/reader/epubTransition.ts; preserves sanitized publisher styling.
/** Preserve the outgoing viewport while epub.js loads and paginates a
 * different chapter. In particular, going back must never paint page one
 * before moving to the previous chapter's final physical screen. */
const snapshotRoot = '[data-libra-snapshot-root]';
const rootSelector = (selector) => selector.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|:root\b/g, token => token === ':root' ? snapshotRoot : token);
/** A shadow tree has the app's viewport, not the EPUB iframe's. Resolve
 * viewport units and responsive branches before moving publisher CSS. */
function snapshotStyles(doc, width, height) {
    const units = (value) => value.replace(/url\((?:\\.|[^)])*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|([^\w.-]|^)(-?(?:\d+(?:\.\d+)?|\.\d+))((?:[dsl]?v[hw])|vmin|vmax)\b/gi, (token, prefix, amount, unit) => {
        if (amount === undefined || unit === undefined)
            return token;
        const side = unit === 'vmin' ? Math.min(width, height) : unit === 'vmax' ? Math.max(width, height) : unit.endsWith('w') ? width : height;
        return (prefix || '') + (Number(amount) * side / 100) + 'px';
    });
    const declarations = (style) => Array.from({ length: style.length }, (_, i) => {
        const property = style.item ? style.item(i) : style[i], priority = style.getPropertyPriority(property);
        return property + ':' + units(style.getPropertyValue(property)) + (priority ? '!' + priority : '') + ';';
    }).join('');
    const rules = (source) => Array.from(source, rule => {
        if (rule.type === 3) {
            const imported = rule, condition = imported.media.mediaText;
            if (condition && doc.defaultView?.matchMedia && !doc.defaultView.matchMedia(condition).matches)
                return '';
            try {
                if (imported.styleSheet)
                    return rules(imported.styleSheet.cssRules);
            }
            catch { /* Keep a source import if it is inaccessible. */ }
        }
        if (rule.type === 4 && doc.defaultView?.matchMedia) {
            const media = rule;
            return doc.defaultView.matchMedia(media.conditionText).matches ? rules(media.cssRules) : '';
        }
        const styled = rule;
        if (styled.style && typeof styled.selectorText === 'string')
            return rootSelector(styled.selectorText) + '{' + declarations(styled.style) + (styled.cssRules?.length ? rules(styled.cssRules) : '') + '}';
        const group = rule;
        if (group.cssRules)
            return rootSelector(rule.cssText.slice(0, rule.cssText.indexOf('{'))) + '{' + rules(group.cssRules) + '}';
        return rule.cssText;
    }).join('\n');
    return { units, rules };
}
export function freezeEpubViewport(host) {
    const box = host.getBoundingClientRect();
    const copies = [];
    for (const frame of Array.from(host.querySelectorAll('iframe'))) {
        const rect = frame.getBoundingClientRect(), doc = frame.contentDocument;
        if (doc?.body && rect.width > 0 && rect.height > 0 && rect.right > box.left && rect.left < box.right && rect.bottom > box.top && rect.top < box.bottom)
            copies.push({ frame, rect, doc });
    }
    if (!copies.length)
        return () => { };
    const overlay = host.ownerDocument.createElement('div');
    overlay.className = 'epub-transition-freeze';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    Object.assign(overlay.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none', zIndex: '20', background: 'var(--bg)' });
    for (const { rect, doc } of copies) {
        const plane = host.ownerDocument.createElement('div');
        Object.assign(plane.style, { position: 'absolute', left: rect.left - box.left + 'px', top: rect.top - box.top + 'px', width: rect.width + 'px', height: rect.height + 'px', pointerEvents: 'none' });
        const shadow = plane.attachShadow({ mode: 'open' });
        const copy = doc.documentElement.cloneNode(true);
        copy.setAttribute('data-libra-snapshot-root', '');
        // In an iframe html/body overflow is propagated to its viewport. Inside
        // shadow DOM body is an ordinary box: overflow:hidden would cut off all
        // columns after page one. The outer frozen plane owns the clipping.
        copy.style.setProperty('overflow', 'visible', 'important');
        copy.querySelector('body')?.style.setProperty('overflow', 'visible', 'important');
        const sourceSheets = Array.from(doc.querySelectorAll('style,link[rel="stylesheet"]'));
        const copySheets = Array.from(copy.querySelectorAll('style,link[rel="stylesheet"]'));
        const css = snapshotStyles(doc, doc.defaultView?.innerWidth || rect.width, doc.defaultView?.innerHeight || rect.height);
        // The source was sandboxed. A visual copy in the parent document must
        // never reactivate publisher scripts, handlers, media or navigation.
        for (const element of Array.from(copy.querySelectorAll('script,iframe,object,embed,audio,video,meta,base')))
            element.remove();
        for (const element of [copy, ...Array.from(copy.querySelectorAll('*'))]) {
            for (const attribute of Array.from(element.attributes))
                if (/^on/i.test(attribute.name))
                    element.removeAttribute(attribute.name);
            const style = element.style;
            if (style)
                for (const property of Array.from({ length: style.length }, (_, i) => style.item(i))) {
                    const value = style.getPropertyValue(property), resolved = css.units(value);
                    if (resolved !== value)
                        style.setProperty(property, resolved, style.getPropertyPriority(property));
                }
        }
        const sourceImages = Array.from(doc.querySelectorAll('img'));
        for (const [index, image] of Array.from(copy.querySelectorAll('img')).entries()) {
            const source = sourceImages[index];
            if (source)
                image.setAttribute('src', source.currentSrc || source.src);
        }
        // Inline already-loaded sheets instead of awaiting a second stylesheet
        // download during the transition. Shadow DOM isolates their html/body rules.
        const rules = [];
        for (const sheet of Array.from(doc.styleSheets)) {
            try {
                rules.push(css.rules(sheet.cssRules));
                const index = sourceSheets.findIndex(node => node.sheet === sheet);
                if (index >= 0)
                    copySheets[index]?.remove();
            }
            catch { /* Keep an inaccessible source sheet below. */ }
        }
        const style = host.ownerDocument.createElement('style');
        style.textContent = rules.join('\n') + '\n* { animation-play-state:paused!important; transition:none!important; caret-color:transparent!important; }';
        shadow.append(style, copy);
        overlay.append(plane);
    }
    host.append(overlay);
    return () => overlay.remove();
}
