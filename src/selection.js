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

    // Keep cursor in the top 0-30% of the viewport for better reading flow
    // Use block-level ancestor for consistent scroll behavior (not inline elements like <a>)
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

function setVisualMode(on) {
    state.mode = on ? 'visual' : 'normal';
    document.documentElement.classList.toggle('vimwalk-visual', on);
    modeIndicator.classList.toggle('visible', on);

    const sel = window.getSelection();

    if (!on && sel.rangeCount > 0) {
        // Exiting visual mode: restore single-char cursor at focus position
        const node = sel.focusNode;
        const offset = sel.focusOffset;
        sel.removeAllRanges();
        if (node && node.nodeType === Node.TEXT_NODE && offset < node.textContent.length) {
            const range = document.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + 1);
            sel.addRange(range);
        }
    } else if (sel.rangeCount > 0) {
        // Entering visual mode: force re-render of ::selection color
        const range = sel.getRangeAt(0).cloneRange();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}
