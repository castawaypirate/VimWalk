; (function () {
    'use strict';

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
            let startBlock = getBlockAncestor(currentIterationNode.parentElement);

            while (currentIterationNode && nodesChecked < maxNodes) {
                nodesChecked++;
                currentIterationNode = walker.nextNode();

                if (currentIterationNode) {
                    let currBlock = getBlockAncestor(currentIterationNode.parentElement);

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
            let startBlock = getBlockAncestor(currentIterationNode.parentElement);

            let targetNode = null;
            let targetBlock = null;

            while (currentIterationNode && nodesChecked < maxNodes) {
                nodesChecked++;
                currentIterationNode = walker.previousNode();

                if (currentIterationNode) {
                    let currBlock = getBlockAncestor(currentIterationNode.parentElement);

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
            // Vim 'b': jump backward to the start of the previous word.
            // Two-phase scan across text node boundaries:
            //   Phase 1 (skip_non_word): skip non-word chars backward
            //   Phase 2 (skip_word): skip word chars backward, tracking the earliest position
            // When phase 2 hits a non-word char (or content runs out), land on the tracked position.

            let phase = 'skip_non_word';
            let candidateNode = null;
            let candidateOffset = -1;
            let scanNode = currentNode;
            let scanIdx = (scanNode.nodeType === Node.TEXT_NODE) ? currentOffset - 1 : -1;

            while (nodesChecked < maxNodes) {
                if (scanNode && scanNode.nodeType === Node.TEXT_NODE) {
                    const text = scanNode.textContent;
                    if (scanIdx >= text.length) scanIdx = text.length - 1;

                    for (let i = scanIdx; i >= 0; i--) {
                        const isWord = wordParam.test(text[i]);

                        if (phase === 'skip_non_word') {
                            if (isWord) {
                                phase = 'skip_word';
                                candidateNode = scanNode;
                                candidateOffset = i;
                            }
                        } else { // phase === 'skip_word'
                            if (isWord) {
                                candidateNode = scanNode;
                                candidateOffset = i;
                            } else {
                                // Hit non-word boundary — candidate is the word start
                                moveTo(candidateNode, candidateOffset, visualMode);
                                return;
                            }
                        }
                    }
                }

                // Move to the previous text node (walker filters out invisible/script/style)
                nodesChecked++;
                scanNode = walker.previousNode();
                if (!scanNode) break;
                scanIdx = scanNode.textContent.length - 1;
            }

            // Reached start of content while scanning — land on earliest word char found
            if (candidateNode) {
                moveTo(candidateNode, candidateOffset, visualMode);
            }
            return;
        }
    }

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

    let visualMode = false;

    // Inject the mode indicator element
    const modeIndicator = document.createElement('div');
    modeIndicator.id = 'vimwalk-mode-indicator';
    modeIndicator.textContent = '-- VISUAL --';
    document.documentElement.appendChild(modeIndicator);

    function setVisualMode(on) {
        visualMode = on;
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

    document.addEventListener('keydown', (e) => {
        // Context safety: ignore if typing in input
        if (isInputActive()) return;

        if (e.key === 'v' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            setVisualMode(!visualMode);
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
            setVisualMode(false);
            e.preventDefault();
            return;
        }

        if (e.key === 'Escape') {
            if (visualMode) {
                setVisualMode(false);
            }
            return;
        }

        if ((e.key === 'w' || e.key === 'b' || e.key === '}' || e.key === '{') && !e.ctrlKey && !e.altKey && !e.metaKey) {
            handleNavigation(e.key);
            e.preventDefault();
        }
    });

})();
