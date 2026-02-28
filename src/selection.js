'use strict';

/**
 * VimWalk — Selection management and visual mode.
 * Depends on: state.js (state, isVisual), dom.js (getBlockAncestor)
 */

function moveTo(node, offset, extend) {
    const selection = window.getSelection();

    if (extend) {
        selection.extend(node, offset);
    } else {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, Math.min(offset + 1, node.textContent.length));
        selection.removeAllRanges();
        selection.addRange(range);
    }

    scrollToNode(node);
}

function selectWord(node, offset) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent;
    if (text.length === 0) return;

    let start = offset;
    let end = offset;

    while (start > 0 && isWordChar(text[start - 1])) {
        start--;
    }

    while (end < text.length && isWordChar(text[end])) {
        end++;
    }

    if (start === end) return;

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    selection.removeAllRanges();
    selection.addRange(range);

    scrollToNode(node);
}

function scrollToNode(node) {
    let scrollElement = getBlockAncestor(node.parentElement);

    if (scrollElement) {
        const rect = scrollElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const threshold = viewportHeight * 0.30;
        const targetPosition = viewportHeight * 0.10;

        if (rect.top > threshold) {
            window.scrollBy({ top: rect.top - targetPosition, behavior: 'smooth' });
        } else if (rect.top < 0) {
            window.scrollBy({ top: rect.top - targetPosition, behavior: 'smooth' });
        }
    }
}

// Inject the mode indicator element
const modeIndicator = document.createElement('div');
modeIndicator.id = 'vimwalk-mode-indicator';
modeIndicator.textContent = '-- VISUAL --';
document.documentElement.appendChild(modeIndicator);

function setVisualMode(on, exitAction = 'cursor') {
    state.mode = on ? 'visual' : 'normal';
    document.documentElement.classList.toggle('vimwalk-visual', on);
    modeIndicator.classList.toggle('visible', on);

    const sel = window.getSelection();

    if (!on && sel.rangeCount > 0) {
        if (exitAction === 'clear') {
            sel.removeAllRanges();
        } else {
            const node = sel.focusNode;
            const offset = sel.focusOffset;
            sel.removeAllRanges();
            if (node && node.nodeType === Node.TEXT_NODE && offset < node.textContent.length) {
                const range = document.createRange();
                range.setStart(node, offset);
                range.setEnd(node, offset + 1);
                sel.addRange(range);
            }
        }
    } else if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}
