'use strict';

/**
 * VimWalk — Motion functions.
 * Depends on: state.js (isWordChar, MAX_NODES), dom.js (getBlockAncestor),
 *             selection.js (moveTo)
 */

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
    let motionState = 'seeking_break';

    let searchNode = currentNode;
    let searchOffset = currentOffset;

    if (searchNode.nodeType === Node.TEXT_NODE) {
        const charAtCursor = (searchOffset < searchNode.textContent.length) ? searchNode.textContent[searchOffset] : null;
        if (!charAtCursor) motionState = 'seeking_break';
        else if (!isWordChar(charAtCursor)) motionState = 'seeking_start';
        else motionState = 'seeking_break';
    } else {
        motionState = 'seeking_start';
    }

    let currentIterationNode = currentNode;
    while (currentIterationNode && nodesChecked < MAX_NODES) {
        nodesChecked++;
        if (currentIterationNode.nodeType === Node.TEXT_NODE) {
            const text = currentIterationNode.textContent;
            const startIdx = (currentIterationNode === searchNode) ? searchOffset : 0;

            for (let i = startIdx; i < text.length; i++) {
                const charIsWord = isWordChar(text[i]);
                if (motionState === 'seeking_break') {
                    if (!charIsWord) motionState = 'seeking_start';
                } else if (motionState === 'seeking_start') {
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

var MOTIONS = {
    'w': motionW,
    'b': motionB,
    '}': motionBraceForward,
    '{': motionBraceBackward,
};
