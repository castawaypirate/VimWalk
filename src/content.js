; (function () {
    'use strict';

    /**
     * VimWalk - Navigate static content with 'w'
     */

    const WORD_CHAR = /[a-zA-Z0-9_]/;
    function isWordChar(ch) { return WORD_CHAR.test(ch); }

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

    const MAX_NODES = 1000;

    function motionBraceForward(currentIterationNode, _currentOffset, walker, extend) {
        let nodesChecked = 0;
        let startBlock = getBlockAncestor(currentIterationNode.parentElement);

        while (currentIterationNode && nodesChecked < MAX_NODES) {
            nodesChecked++;
            currentIterationNode = walker.nextNode();

            if (currentIterationNode) {
                let currBlock = getBlockAncestor(currentIterationNode.parentElement);

                if (currBlock !== startBlock) {
                    moveTo(currentIterationNode, 0, extend);
                    return;
                }
            }
        }
    }

    function motionBraceBackward(currentIterationNode, _currentOffset, walker, extend) {
        let nodesChecked = 0;
        let startBlock = getBlockAncestor(currentIterationNode.parentElement);
        let targetNode = null;
        let targetBlock = null;

        while (currentIterationNode && nodesChecked < MAX_NODES) {
            nodesChecked++;
            currentIterationNode = walker.previousNode();

            if (currentIterationNode) {
                let currBlock = getBlockAncestor(currentIterationNode.parentElement);

                if (currBlock !== startBlock) {
                    if (targetBlock === null) {
                        targetBlock = currBlock;
                    }
                    if (currBlock === targetBlock) {
                        targetNode = currentIterationNode;
                    } else {
                        break;
                    }
                }
            }
        }

        if (targetNode) {
            moveTo(targetNode, 0, extend);
        }
    }

    function motionW(currentNode, currentOffset, walker, extend) {
        let nodesChecked = 0;
        let state = 'seeking_break';

        let searchNode = currentNode;
        let searchOffset = currentOffset;

        if (searchNode.nodeType === Node.TEXT_NODE) {
            const charAtCursor = (searchOffset < searchNode.textContent.length) ? searchNode.textContent[searchOffset] : null;
            if (!charAtCursor) state = 'seeking_break';
            else if (!isWordChar(charAtCursor)) state = 'seeking_start';
            else state = 'seeking_break';
        } else {
            state = 'seeking_start';
        }

        let currentIterationNode = currentNode;
        while (currentIterationNode && nodesChecked < MAX_NODES) {
            nodesChecked++;
            if (currentIterationNode.nodeType === Node.TEXT_NODE) {
                const text = currentIterationNode.textContent;
                const startIdx = (currentIterationNode === searchNode) ? searchOffset : 0;

                for (let i = startIdx; i < text.length; i++) {
                    const charIsWord = isWordChar(text[i]);
                    if (state === 'seeking_break') {
                        if (!charIsWord) state = 'seeking_start';
                    } else if (state === 'seeking_start') {
                        if (charIsWord) {
                            moveTo(currentIterationNode, i, extend);
                            return;
                        }
                    }
                }
            }
            currentIterationNode = walker.nextNode();
        }
    }

    function motionB(currentNode, currentOffset, walker, extend) {
        let nodesChecked = 0;
        let phase = 'skip_non_word';
        let candidateNode = null;
        let candidateOffset = -1;
        let scanNode = currentNode;
        let scanIdx = (scanNode.nodeType === Node.TEXT_NODE) ? currentOffset - 1 : -1;

        while (nodesChecked < MAX_NODES) {
            if (scanNode && scanNode.nodeType === Node.TEXT_NODE) {
                const text = scanNode.textContent;
                if (scanIdx >= text.length) scanIdx = text.length - 1;

                for (let i = scanIdx; i >= 0; i--) {
                    const isWord = isWordChar(text[i]);

                    if (phase === 'skip_non_word') {
                        if (isWord) {
                            phase = 'skip_word';
                            candidateNode = scanNode;
                            candidateOffset = i;
                        }
                    } else {
                        if (isWord) {
                            candidateNode = scanNode;
                            candidateOffset = i;
                        } else {
                            moveTo(candidateNode, candidateOffset, extend);
                            return;
                        }
                    }
                }
            }

            nodesChecked++;
            scanNode = walker.previousNode();
            if (!scanNode) break;
            scanIdx = scanNode.textContent.length - 1;
        }

        if (candidateNode) {
            moveTo(candidateNode, candidateOffset, extend);
        }
    }

    const MOTIONS = {
        'w': motionW,
        'b': motionB,
        '}': motionBraceForward,
        '{': motionBraceBackward,
    };

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

    const state = { mode: 'normal' };
    function isVisual() { return state.mode === 'visual'; }

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

    document.addEventListener('keydown', (e) => {
        // Context safety: ignore if typing in input
        if (isInputActive()) return;

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

})();
