'use strict';

/**
 * ReadWalk — Mouse mode handling.
 * Depends on: state.js (isVisual), dom.js (isInputActive, createWalker),
 *             selection.js (hasSelection), motions.js (MOTIONS)
 */

let mouseModeEnabled = false;

function hasSelection() {
    const selection = window.getSelection();
    return selection.rangeCount > 0 && selection.toString().length > 0;
}

function findTextNodeAtPoint(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;

    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                if (node.textContent.trim().length === 0) return NodeFilter.FILTER_REJECT;
                const tag = node.parentElement?.tagName?.toLowerCase();
                if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );

    let closestNode = null;
    let closestDistance = Infinity;

    while (walker.nextNode()) {
        const node = walker.currentNode;
        const range = document.createRange();
        range.selectNodeContents(node);

        const rects = range.getClientRects();
        for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            const dx = Math.max(rect.left - x, 0, x - rect.right);
            const dy = Math.max(rect.top - y, 0, y - rect.bottom);
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestNode = node;
            }
        }
    }

    return closestNode;
}

function getOffsetAtPoint(x, y, textNode) {
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return 0;

    const range = document.createRange();
    const textLength = textNode.textContent.length;

    for (let i = 0; i <= textLength; i++) {
        range.setStart(textNode, i);
        range.setEnd(textNode, i);
        const rect = range.getBoundingClientRect();

        if (rect.left > x || rect.right > x) {
            return Math.max(0, i - 1);
        }
    }

    return textLength - 1;
}

function handleMouseClick(event) {
    if (!mouseModeEnabled) return;
    if (isInputActive()) return;
    if (event.button !== 0 && event.button !== 2) return;

    if (!hasSelection()) return;

    const selection = window.getSelection();
    const extend = isVisual();

    let targetNode;
    let targetOffset;

    if (selection.anchorNode && selection.anchorNode.nodeType === Node.TEXT_NODE) {
        targetNode = selection.anchorNode;
        targetOffset = selection.anchorOffset;
    } else {
        targetNode = findTextNodeAtPoint(event.clientX, event.clientY);
        if (!targetNode) return;
        targetOffset = getOffsetAtPoint(event.clientX, event.clientY, targetNode);
    }

    const walker = createWalker(document.body, NodeFilter.SHOW_TEXT, targetNode);

    if (event.button === 0) {
        event.preventDefault();
        MOTIONS.w(targetNode, targetOffset, walker, extend);
    } else if (event.button === 2) {
        event.preventDefault();
        MOTIONS.b(targetNode, targetOffset, walker, extend);
    }

    event.stopPropagation();
}

function handleContextMenu(event) {
    if (!mouseModeEnabled) return;
    if (isInputActive()) return;

    if (hasSelection()) {
        event.preventDefault();
    }
}

const mouseIndicator = document.createElement('div');
mouseIndicator.id = 'readwalk-mouse-indicator';
mouseIndicator.textContent = '-- MOUSE --';
document.documentElement.appendChild(mouseIndicator);

function updateMouseIndicator() {
    const show = mouseModeEnabled;
    mouseIndicator.classList.toggle('visible', show);
    document.documentElement.classList.toggle('readwalk-mouse-mode', show);
}

browser.storage.local.get('mouseModeEnabled').then((result) => {
    mouseModeEnabled = result.mouseModeEnabled || false;
    updateMouseIndicator();
}).catch(() => {
    mouseModeEnabled = false;
});

browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && 'mouseModeEnabled' in changes) {
        mouseModeEnabled = changes.mouseModeEnabled.newValue;
        updateMouseIndicator();
    }
});

document.addEventListener('mousedown', handleMouseClick, true);
document.addEventListener('contextmenu', handleContextMenu, true);
