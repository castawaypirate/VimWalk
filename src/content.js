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

    let currentNode = selection.focusNode;
    let currentOffset = selection.focusOffset;

    // Create a TreeWalker to navigate text nodes
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // Ignore invisible nodes or script/style tags
                if (node.parentElement.offsetParent === null) return NodeFilter.FILTER_REJECT;
                const tag = node.parentElement.tagName.toLowerCase();
                if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        },
        false
    );

    walker.currentNode = currentNode;

    // Regex for finding the Start of a Word.
    const wordParam = /[a-zA-Z0-9_]/;

    let searchNode = currentNode;
    let searchOffset = currentOffset;
    let state = 'seeking_break';

    // INITIAL STATE CHECK
    if (searchNode.nodeType === Node.TEXT_NODE) {
        const charAtCursor = (searchOffset < searchNode.textContent.length) ? searchNode.textContent[searchOffset] : null;

        if (!charAtCursor) {
            state = 'seeking_break';
        } else if (!wordParam.test(charAtCursor)) {
            state = 'seeking_start';
        } else {
            state = 'seeking_break';
        }
    } else {
        state = 'seeking_start';
    }

    const maxNodes = 1000;
    let nodesChecked = 0;
    let currentIterationNode = searchNode;

    while (currentIterationNode && nodesChecked < maxNodes) {
        nodesChecked++;

        if (currentIterationNode.nodeType === Node.TEXT_NODE) {
            const text = currentIterationNode.textContent;

            // If this is the starting node, start at offset. Otherwise start at 0.
            const startIdx = (currentIterationNode === searchNode) ? searchOffset : 0;

            for (let i = startIdx; i < text.length; i++) {
                const char = text[i];
                const isWordChar = wordParam.test(char);

                if (state === 'seeking_break') {
                    if (!isWordChar) {
                        state = 'seeking_start';
                    }
                }

                if (state === 'seeking_start') {
                    if (isWordChar) {
                        // Found the start of the next word!
                        const range = document.createRange();
                        range.setStart(currentIterationNode, i);
                        range.setEnd(currentIterationNode, i + 1); // Highlight first char
                        selection.removeAllRanges();
                        selection.addRange(range);
                        return;
                    }
                }
            }
        }

        // Move to next node
        currentIterationNode = walker.nextNode();
    }
}

document.addEventListener('keydown', (e) => {
    // Context safety: ignore if typing in input
    if (isInputActive()) return;

    if (e.key === 'w' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        handleNavigation();
        e.preventDefault();
    }
});

console.log("VimWalk: Robust Logic Loaded.");
