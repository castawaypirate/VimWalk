'use strict';

/**
 * VimWalk — DOM utilities.
 * Depends on: (nothing)
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

function createWalker(root, what, current) {
    const walker = document.createTreeWalker(
        root,
        what,
        {
            acceptNode: (node) => {
                if (node.parentElement.offsetParent === null) return NodeFilter.FILTER_REJECT;
                const tag = node.parentElement.tagName.toLowerCase();
                if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );
    walker.currentNode = current;
    return walker;
}

/**
 * Walk up the DOM from `element` to find the nearest block-level ancestor.
 * Skips all inline-level display values so paragraph detection works with
 * modern CSS layouts (inline-block, inline-flex, inline-grid, etc.).
 */
const inlineDisplays = new Set([
    'inline', 'inline-block', 'inline-flex', 'inline-grid',
    'inline-table', 'contents', 'ruby', 'ruby-text',
    'ruby-base', 'ruby-text-container', 'ruby-base-container',
]);

function getBlockAncestor(element) {
    let el = element;
    while (el && el !== document.body) {
        const display = getComputedStyle(el).display;
        if (!inlineDisplays.has(display)) return el;
        el = el.parentElement;
    }
    return el || document.body;
}
