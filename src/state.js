'use strict';

/**
 * VimWalk — Shared state and constants.
 * Loaded first; symbols are available to all subsequent content scripts.
 */

const WORD_CHAR = /[a-zA-Z0-9_]/;
function isWordChar(ch) { return WORD_CHAR.test(ch); }

var MAX_NODES = 1000;

var state = { mode: 'normal' };
function isVisual() { return state.mode === 'visual'; }
