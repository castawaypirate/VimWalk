'use strict';

/**
 * VimWalk — Input handling.
 * Depends on: state.js (isVisual), dom.js (isInputActive, ensureSelection, createWalker),
 *             selection.js (setVisualMode), motions.js (MOTIONS)
 */

function handleNavigation(key) {
    const fn = MOTIONS[key];
    if (!fn) return;

    const selection = window.getSelection();

    if (!ensureSelection()) return;

    let currentNode = selection.focusNode;
    let currentOffset = selection.focusOffset;

    if (!isVisual()) {
        if (key === 'b' || key === '{') {
            selection.collapseToStart();
        } else {
            selection.collapseToEnd();
        }
    }

    currentNode = selection.focusNode;
    currentOffset = selection.focusOffset;

    const walker = createWalker(document.body, NodeFilter.SHOW_TEXT, currentNode);

    fn(currentNode, currentOffset, walker, isVisual());
}

document.addEventListener('keydown', (e) => {
    // Context safety: ignore if typing in input
    if (isInputActive()) return;

    // Activate scoped ::selection styles on first VimWalk keypress
    if (!document.documentElement.classList.contains('vimwalk-active')) {
        document.documentElement.classList.add('vimwalk-active');
    }

    if (e.key === 'v' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        setVisualMode(!isVisual());
        e.preventDefault();
        return;
    }

    if (e.key === 'y' && isVisual() && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const selection = window.getSelection();
        const text = selection.toString();
        if (text) {
            navigator.clipboard.writeText(text).catch(() => { });
        }
        setVisualMode(false);
        e.preventDefault();
        return;
    }

    if (e.key === 'Escape') {
        if (isVisual()) {
            setVisualMode(false);
        }
        return;
    }

    if ((e.key === 'w' || e.key === 'b' || e.key === '}' || e.key === '{') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        handleNavigation(e.key);
        e.preventDefault();
    }
});
