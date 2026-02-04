/**
 * VimWalk - Navigate static content with 'w'
 */

function isInputActive() {
    const activeInfo = document.activeElement;
    if (!activeInfo) return false;
    const tagName = activeInfo.tagName.toLowerCase();
    const isEditable = activeInfo.isContentEditable;
    return tagName === 'input' || tagName === 'textarea' || isEditable;
}

function ensureSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0 || selection.isCollapsed && selection.focusNode === null) {
        // Simple initialization: try to select the first text node in body
        // This is a naive approach; we might want a TreeWalker later for better precision
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const firstNode = walker.nextNode();
        if (firstNode) {
            const range = document.createRange();
            range.setStart(firstNode, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return true;
        }
    }
    return selection.rangeCount > 0;
}

function handleNavigation() {
    const selection = window.getSelection();

    // Ensure we have a starting point
    if (!ensureSelection()) return;

    // Start from the end of the current selection (or caret)
    selection.collapseToEnd();

    // Move forward by word
    // Note: Behavior varies by platform. Firefox might stop before the space.
    selection.modify("move", "forward", "word");

    // Extend by one character to highlight the first letter
    selection.modify("extend", "forward", "character");

    // Correction: If the selection is whitespace, it means we landed on a space.
    // We should advance until we find a non-whitespace character.
    // This allows us to "skip" spaces if the browser's 'word' boundary included them or stopped early.
    while (selection.toString().trim() === "" && selection.toString().length > 0) {
        selection.collapseToEnd();
        selection.modify("extend", "forward", "character");
    }
}

document.addEventListener('keydown', (e) => {
    // Context safety: ignore if typing in input
    if (isInputActive()) return;

    // Check for 'w' key (lowercase)
    // We should probably allow strict 'w' (without modifiers like Ctrl/Alt/Meta)
    // Shift+w (W) is typically 'move back' or 'move BIG word' in Vim, but brief says 'w' = forward.
    // Let's stick to simple 'w' for now.

    if (e.key === 'w' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        handleNavigation();
        // Prevent default only if we effectively handled it? 
        // Or always prevent to avoid typing 'w' if it accidentally focuses something?
        // Usually safe to prevent default for navigation keys.
        e.preventDefault();
    }
});

console.log("VimWalk: Core logic loaded.");
