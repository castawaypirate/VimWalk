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

function createWalker(root, what, current) {
    const walker = document.createTreeWalker(
        root,
        what,
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
    walker.currentNode = current;
    return walker;
}

function handleNavigation(key) {
    const selection = window.getSelection();

    // Ensure we have a starting point
    if (!ensureSelection()) return;

    let currentNode = selection.focusNode;
    let currentOffset = selection.focusOffset;

    // Start from the end of the current selection (or caret) usually,
    // but for 'b' we might want to start from focusNode/Offset as is.
    // Vim logic:
    // 'w': start from current position, find next word start.
    // 'b': start from current position, find previous word start.
    // '}': start from current position, find next paragraph.

    // If NOT visual mode, we usually collapse to a single point.
    // For 'b', if we have a selection and not visual mode, where do we start?
    // Standard Vim: cursor is at one end. Browser selection has anchor/focus. Focus is the "active" end.
    // We will trust `selection.focusNode` and `selection.focusOffset`.

    if (!visualMode) {
        // If we are just moving the cursor, collapse to the "active" end so we start searching from there.
        // For 'w'/'}', we want to move forward from where we are (End).
        // For 'b'/'{', we want to move backward from where we are (Start).
        if (key === 'b' || key === '{') {
            selection.collapseToStart();
        } else {
            selection.collapseToEnd();
        }
    }

    // Re-read currentNode/Offset after collapse
    currentNode = selection.focusNode;
    currentOffset = selection.focusOffset;

    const walker = createWalker(document.body, NodeFilter.SHOW_TEXT, currentNode);
    const wordParam = /[a-zA-Z0-9_]/;
    const maxNodes = 1000;
    let nodesChecked = 0;
    let currentIterationNode = currentNode;

    // Direction logic
    const isForward = (key === 'w' || key === '}');
    const isParagraphBack = (key === '{');
    const isBackward = (key === 'b');

    if (key === '}') {
        let startBlock = currentIterationNode.parentElement;
        while (startBlock && getComputedStyle(startBlock).display === 'inline') {
            startBlock = startBlock.parentElement;
        }

        while (currentIterationNode && nodesChecked < maxNodes) {
            nodesChecked++;
            currentIterationNode = walker.nextNode();

            if (currentIterationNode) {
                let currBlock = currentIterationNode.parentElement;
                while (currBlock && getComputedStyle(currBlock).display === 'inline') {
                    currBlock = currBlock.parentElement;
                }

                // If we found a node in a different block, stop
                if (currBlock !== startBlock) {
                    moveTo(currentIterationNode, 0, visualMode);
                    return;
                }
            }
        }
        return;
    }

    if (key === '{') {
        let startBlock = currentIterationNode.parentElement;
        while (startBlock && getComputedStyle(startBlock).display === 'inline') {
            startBlock = startBlock.parentElement;
        }

        let targetNode = null;
        let targetBlock = null;

        while (currentIterationNode && nodesChecked < maxNodes) {
            nodesChecked++;
            currentIterationNode = walker.previousNode();

            if (currentIterationNode) {
                let currBlock = currentIterationNode.parentElement;
                while (currBlock && getComputedStyle(currBlock).display === 'inline') {
                    currBlock = currBlock.parentElement;
                }

                // If we found a node in a different block, track it
                if (currBlock !== startBlock) {
                    // Keep going back to find the first text node of this paragraph
                    if (targetBlock === null) {
                        targetBlock = currBlock;
                    }
                    if (currBlock === targetBlock) {
                        targetNode = currentIterationNode;
                    } else {
                        // We've gone past the target paragraph, stop
                        break;
                    }
                }
            }
        }

        if (targetNode) {
            moveTo(targetNode, 0, visualMode);
        }
        return;
    }

    if (key === 'w') {
        let state = 'seeking_break'; // default assumption

        let searchNode = currentNode;
        let searchOffset = currentOffset;

        // INITIAL STATE CHECK for 'w'
        // Reuse existing logic structure roughly
        if (searchNode.nodeType === Node.TEXT_NODE) {
            const charAtCursor = (searchOffset < searchNode.textContent.length) ? searchNode.textContent[searchOffset] : null;
            if (!charAtCursor) state = 'seeking_break';
            else if (!wordParam.test(charAtCursor)) state = 'seeking_start'; // on non-word, look for word
            else state = 'seeking_break'; // on word, look for break then word
        } else {
            state = 'seeking_start';
        }

        while (currentIterationNode && nodesChecked < maxNodes) {
            nodesChecked++;
            if (currentIterationNode.nodeType === Node.TEXT_NODE) {
                const text = currentIterationNode.textContent;
                const startIdx = (currentIterationNode === searchNode) ? searchOffset : 0;

                for (let i = startIdx; i < text.length; i++) {
                    const isWordChar = wordParam.test(text[i]);
                    if (state === 'seeking_break') {
                        if (!isWordChar) state = 'seeking_start';
                    } else if (state === 'seeking_start') {
                        if (isWordChar) {
                            moveTo(currentIterationNode, i, visualMode);
                            return;
                        }
                    }
                }
            }
            currentIterationNode = walker.nextNode();
        }
    }

    if (key === 'b') {
        // Backward logic
        // We are looking for the *start* of a word.
        // If we are ON a word char, we might be in the middle of a word.
        // 1. Scan back to find start of current word?
        // 2. OR if we are at start of word, scan back to previous word.

        let state = 'initial';
        // Logic:
        // Scan backwards.
        // If we hit a non-word char, we are definitely out of a word.
        // If we then hit a word char, we are in a NEW word (the previous one).
        // We need to keep going back until we hit non-word OR start of node to find the START of that word.

        // Simpler Vim 'b' rule: 
        // Go to [start of word].

        let subNodesChecked = 0;

        // We need to iterate characters backwards

        // Helper to get text backwards

        while (currentIterationNode && subNodesChecked < maxNodes) {
            subNodesChecked++;
            if (currentIterationNode.nodeType === Node.TEXT_NODE) {
                const text = currentIterationNode.textContent;
                // start index: if first node, searchOffset - 1. Else length - 1.
                let startIdx = (currentIterationNode === currentNode) ? currentOffset - 1 : text.length - 1;

                for (let i = startIdx; i >= 0; i--) {
                    const isWordChar = wordParam.test(text[i]);

                    if (state === 'initial') {
                        if (!isWordChar) {
                            state = 'seeking_word_end'; // Found space, now looking for word text
                        } else {
                            // We are on a word char.
                            // Are we at the START of the current word?
                            // Check previous char
                            if (i > 0 && wordParam.test(text[i - 1])) {
                                // We are in the middle/end of a word.
                                // 'b' should go to start of THIS word?
                                // Vim: "word backwards". `he|llo` -> `|hello`. `|hello` -> `|prev`.
                                state = 'seeking_this_word_start';
                            } else {
                                // We are exactly at start of word (or i=0 and prev node check needed?)
                                // Determine if we should go to previous word. 
                                // If we just started, yes.
                                state = 'seeking_word_end';
                            }
                        }
                    }

                    if (state === 'seeking_this_word_start') {
                        if (!isWordChar) {
                            // Oops, we passed the start. The start was i + 1.
                            moveTo(currentIterationNode, i + 1, visualMode);
                            return;
                        }
                        if (i === 0) {
                            // We hit start of node. 
                            // Use logic: if prev node ends with word char, continue. Else this is start.
                            // Check previous node in next iteration? 
                            // Actually walker.previousNode() will give us that.
                            // For now simpler: assume start of node is start of word implies valid break if across nodes? 
                            // Text nodes often split arbitrarily. 
                            // Let's assume adjacent text nodes merge.
                            // Complicated. 
                            // Simplified: if i=0, stopping there is okay-ish, or better:
                            // Check if previous node exists and ends with word char.
                            // Let's just stop at i=0 for now.
                            moveTo(currentIterationNode, 0, visualMode);
                            return;
                        }
                    }

                    if (state === 'seeking_word_end') {
                        if (isWordChar) {
                            // Found end of previous word (since we go backwards).
                            // Now find its start.
                            state = 'seeking_this_word_start';
                            // But we are AT i.
                            // Process this i in next state or just fall through?
                            // Fall through logic:
                            // Re-evaluate 'seeking_this_word_start' logic for this char?
                            // Actually we can just switch state and continue loop, but we need to handle i.
                            // Let's just say we found a char. The word started... somewhere before.
                            // Continue loop.
                            if (i === 0) {
                                moveTo(currentIterationNode, 0, visualMode);
                                return;
                            }
                        }
                    }
                }
            }
            currentIterationNode = walker.previousNode();
        }
    }
}

function moveTo(node, offset, extend) {
    const selection = window.getSelection();

    if (extend) {
        selection.extend(node, offset);
    } else {
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset + 1);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Keep cursor in the top 0-30% of the viewport for better reading flow
    // Use block-level ancestor for consistent scroll behavior (not inline elements like <a>)
    let scrollElement = node.parentElement;
    while (scrollElement && getComputedStyle(scrollElement).display === 'inline') {
        scrollElement = scrollElement.parentElement;
    }

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

    // Update focus highlight if focus mode is enabled
    if (focusMode && scrollElement) {
        updateFocusHighlight(scrollElement);
    }
}

let visualMode = false;
let focusMode = false;
let focusPaused = false; // Temporarily hide overlay on Escape
let focusOverlays = null; // Array of 4 overlay divs
let currentHighlightedElement = null;

/**
 * Create the 2 focus overlay panels (top and bottom bands)
 */
function createFocusOverlays() {
    if (!focusOverlays) {
        focusOverlays = [];
        const positions = ['top', 'bottom'];
        positions.forEach(pos => {
            const overlay = document.createElement('div');
            overlay.className = 'vimwalk-focus-overlay';
            overlay.dataset.position = pos;
            document.body.appendChild(overlay);
            focusOverlays.push(overlay);
        });
    }
    return focusOverlays;
}

/**
 * Remove all focus overlays from the DOM
 */
function removeFocusOverlay() {
    if (focusOverlays) {
        focusOverlays.forEach(overlay => overlay.remove());
        focusOverlays = null;
    }
    if (currentHighlightedElement) {
        currentHighlightedElement.classList.remove('vimwalk-focus-highlight');
        currentHighlightedElement = null;
    }
}

/**
 * Position the overlay panels (top and bottom bands)
 */
function positionOverlays(element) {
    if (!focusOverlays || !element) return;

    const rect = element.getBoundingClientRect();
    const padding = 8; // Gap around the element

    // Only need top and bottom boundaries
    const top = Math.max(0, rect.top - padding);
    const bottom = Math.min(window.innerHeight, rect.bottom + padding);

    focusOverlays.forEach(overlay => {
        const pos = overlay.dataset.position;
        if (pos === 'top') {
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0;
                width: 100vw; height: ${top}px;
            `;
        } else if (pos === 'bottom') {
            overlay.style.cssText = `
                position: fixed; top: ${bottom}px; left: 0;
                width: 100vw; height: calc(100vh - ${bottom}px);
            `;
        }
    });
}

/**
 * Update which element is highlighted in focus mode
 */
function updateFocusHighlight(element) {
    if (!focusMode) return;

    // Remove highlight from previous element
    if (currentHighlightedElement && currentHighlightedElement !== element) {
        currentHighlightedElement.classList.remove('vimwalk-focus-highlight');
    }

    // Add highlight to new element and reposition overlays
    if (element) {
        element.classList.add('vimwalk-focus-highlight');
        currentHighlightedElement = element;
        positionOverlays(element);
    }
}

/**
 * Enable focus mode
 */
function enableFocusMode() {
    focusMode = true;
    createFocusOverlays();

    // Ensure we have a selection, initialize if needed
    ensureSelection();

    // Highlight current paragraph if we have a selection
    const selection = window.getSelection();
    if (selection.focusNode) {
        let block = selection.focusNode.parentElement;
        while (block && getComputedStyle(block).display === 'inline') {
            block = block.parentElement;
        }
        if (block && block !== document.body) {
            updateFocusHighlight(block);
        }
    }
    console.log('VimWalk: Focus Mode ON');
}

/**
 * Disable focus mode
 */
function disableFocusMode() {
    focusMode = false;
    focusPaused = false;
    removeFocusOverlay();
    console.log('VimWalk: Focus Mode OFF');
}

/**
 * Pause focus mode (hide overlay, keep focus mode enabled)
 */
function pauseFocusMode() {
    if (focusMode && !focusPaused) {
        focusPaused = true;
        if (focusOverlays) {
            focusOverlays.forEach(overlay => overlay.style.display = 'none');
        }
        if (currentHighlightedElement) {
            currentHighlightedElement.classList.remove('vimwalk-focus-highlight');
        }
        console.log('VimWalk: Focus Mode paused');
    }
}

/**
 * Resume focus mode (show overlay again)
 */
function resumeFocusMode() {
    if (focusMode && focusPaused) {
        focusPaused = false;
        if (focusOverlays) {
            focusOverlays.forEach(overlay => overlay.style.display = '');
        }
        if (currentHighlightedElement) {
            currentHighlightedElement.classList.add('vimwalk-focus-highlight');
            positionOverlays(currentHighlightedElement);
        }
        console.log('VimWalk: Focus Mode resumed');
    }
}

document.addEventListener('keydown', (e) => {
    // Context safety: ignore if typing in input
    if (isInputActive()) return;

    if (e.key === 'v' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        visualMode = !visualMode;
        console.log(`VimWalk: Visual Mode ${visualMode ? 'ON' : 'OFF'}`);
        e.preventDefault();
        return;
    }

    if (e.key === 'y' && visualMode && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const selection = window.getSelection();
        const text = selection.toString();
        if (text) {
            navigator.clipboard.writeText(text).then(() => {
                console.log("VimWalk: Yanked to clipboard.");
            }).catch(err => {
                console.error("VimWalk: Failed to copy", err);
            });
        }
        visualMode = false;
        selection.collapseToEnd();
        e.preventDefault();
        return;
    }

    if (e.key === 'Escape') {
        if (visualMode) {
            visualMode = false;
            console.log("VimWalk: Visual Mode OFF");
            window.getSelection().collapseToEnd();
        }
        // Pause focus mode on Escape
        if (focusMode && !focusPaused) {
            pauseFocusMode();
        }
        return;
    }

    if ((e.key === 'w' || e.key === 'b' || e.key === '}' || e.key === '{') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Resume focus mode if paused
        if (focusMode && focusPaused) {
            resumeFocusMode();
        }
        handleNavigation(e.key);
        e.preventDefault();
    }
});

// Listen for messages from popup
browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'FOCUS_MODE_TOGGLE') {
        if (message.enabled) {
            enableFocusMode();
        } else {
            disableFocusMode();
        }
    }
});

// Initialize focus mode state from storage on load
browser.storage.local.get('focusMode').then((result) => {
    if (result.focusMode) {
        enableFocusMode();
    }
});

// Reposition overlays when page scrolls (for smooth scroll sync)
window.addEventListener('scroll', () => {
    if (focusMode && currentHighlightedElement) {
        positionOverlays(currentHighlightedElement);
    }
}, { passive: true });

// Also reposition on resize
window.addEventListener('resize', () => {
    if (focusMode && currentHighlightedElement) {
        positionOverlays(currentHighlightedElement);
    }
}, { passive: true });

console.log("VimWalk: Robust Logic Loaded.");
