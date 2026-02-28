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

    if (e.key === 'v' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        setVisualMode(!isVisual());
        e.preventDefault();
        return;
    }

    const selection = window.getSelection();
    const hasSelection = selection.rangeCount > 0 && selection.toString().length > 0;

    if (e.key === 'y' && hasSelection && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const text = selection.toString();
        if (text) {
            navigator.clipboard.writeText(text).catch(() => { });
        }
        if (isVisual()) {
            setVisualMode(false, 'clear');
        } else {
            selection.removeAllRanges();
        }
        e.preventDefault();
        return;
    }

    if (e.key === 'Escape') {
        if (isVisual()) {
            setVisualMode(false);
        } else {
            window.getSelection().removeAllRanges();
        }
        return;
    }

    if ((e.key === 'w' || e.key === 'b' || e.key === '}' || e.key === '{') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        handleNavigation(e.key);
        e.preventDefault();
    }
});
