const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Typing = require('../games/typing');
const { SENTENCES, correctPrefixLength } = Typing;

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

const SENTENCE = 'The quick brown fox jumps over the lazy dog every morning.';

function newGame() {
    const game = new Typing('r', [fakeSocket('a'), fakeSocket('b')], 0);
    game.sentence = SENTENCE;
    return game;
}

function startedGame() {
    const game = newGame();
    game.start();
    return game;
}

describe('Typing sentences', () => {
    it('has a bank of plain ASCII sentences of 8-14 words ending in a period', () => {
        assert.equal(SENTENCES.length >= 25, true);
        for (const s of SENTENCES) {
            assert.match(s, /^[A-Za-z][A-Za-z ,]*\.$/, s);
            const words = s.split(' ').length;
            assert.equal(words >= 8 && words <= 14, true, `${words} words: ${s}`);
            assert.equal(s.length <= 400, true);
        }
    });

    it('picks its sentence from the bank', () => {
        const game = new Typing('r', [fakeSocket('a'), fakeSocket('b')], 0);
        assert.equal(SENTENCES.includes(game.sentence), true);
        assert.equal(game.getStateForPlayer(0).activePlayerIndex, null);
        game.cleanup();
    });

    it('computes the longest correct prefix case-sensitively', () => {
        assert.equal(correctPrefixLength('', SENTENCE), 0);
        assert.equal(correctPrefixLength('The q', SENTENCE), 5);
        assert.equal(correctPrefixLength('the q', SENTENCE), 0);
        assert.equal(correctPrefixLength('The qx', SENTENCE), 5);
        assert.equal(correctPrefixLength(SENTENCE + 'extra', SENTENCE), SENTENCE.length);
    });
});

describe('Typing clock', () => {
    it('does not start a timer in the constructor and rejects typing before start()', () => {
        const game = newGame();
        assert.equal(game.timer, null);
        assert.equal(game.started, false);
        assert.equal(game.getStateForPlayer(0).timeLeft, 120);
        const r = game.makeMove(0, { text: 'The' });
        assert.equal(r.valid, false);
        assert.match(r.message, /clock/i);
        assert.deepEqual(game.progress, [0, 0]);
        game.cleanup();
    });

    it('start/pause/resume/cleanup control the interval', () => {
        const game = newGame();
        game.start();
        assert.notEqual(game.timer, null);
        assert.equal(game.getStateForPlayer(1).started, true);

        game.pause();
        assert.equal(game.timer, null);
        assert.equal(game.paused, true);
        const r = game.makeMove(0, { text: 'The' });
        assert.equal(r.valid, false);
        assert.match(r.message, /paused/i);

        game.resume();
        assert.equal(game.paused, false);
        assert.notEqual(game.timer, null);
        assert.equal(game.makeMove(0, { text: 'The' }).valid, true);

        game.cleanup();
        assert.equal(game.timer, null);
        assert.equal(game.runningSince, null);
    });

    it('ends on the 120 second cap with the player furthest ahead winning', () => {
        const game = startedGame();
        game.makeMove(0, { text: 'The qu' });
        game.makeMove(1, { text: 'The quick' });
        game.timeLeft = 1;
        game.tick();
        assert.equal(game.timeLeft, 0);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 1);
        assert.equal(game.timer, null);
        assert.equal(game.makeMove(0, { text: SENTENCE }).valid, false);
        game.cleanup();
    });

    it('equal progress at the cap is a draw', () => {
        const game = startedGame();
        game.makeMove(0, { text: 'The' });
        game.makeMove(1, { text: 'Thex' });
        game.timeLeft = 1;
        game.tick();
        assert.equal(game.winner, 'draw');
        game.cleanup();
    });
});

describe('Typing progress', () => {
    it('stores the correct prefix length and flags errors', () => {
        const game = startedGame();
        assert.equal(game.makeMove(0, { text: '' }).valid, true);
        assert.deepEqual(game.progress, [0, 0]);
        assert.equal(game.makeMove(0, { text: 'The quick' }).valid, true);
        assert.deepEqual(game.progress, [9, 0]);
        assert.deepEqual(game.hasError, [false, false]);
        assert.equal(game.makeMove(0, { text: 'The quick brwn' }).valid, true);
        assert.equal(game.progress[0], 12);
        assert.equal(game.hasError[0], true);
        // Backspacing the mistake clears the error flag and progress is recomputed.
        assert.equal(game.makeMove(0, { text: 'The qu' }).valid, true);
        assert.equal(game.progress[0], 6);
        assert.equal(game.hasError[0], false);
        game.cleanup();
    });

    it('the first player to type the whole sentence wins and stops the clock', () => {
        const game = startedGame();
        game.makeMove(1, { text: SENTENCE.slice(0, 20) });
        assert.equal(game.makeMove(0, { text: SENTENCE }).valid, true);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 0);
        assert.equal(game.timer, null);
        assert.equal(game.runningSince, null);
        const r = game.makeMove(1, { text: SENTENCE });
        assert.equal(r.valid, false);
        assert.match(r.message, /over/i);
        game.cleanup();
    });

    it('computes words per minute from progress and elapsed time', () => {
        const game = startedGame();
        assert.deepEqual(game.getStateForPlayer(0).wpm.map(w => typeof w), ['number', 'number']);
        game.makeMove(0, { text: SENTENCE.slice(0, 25) });
        game.elapsedSeconds = () => 30;
        assert.equal(game.wpm(0), 10); // 5 words in half a minute
        assert.equal(game.wpm(1), 0);
        game.elapsedSeconds = () => 0;
        assert.equal(game.wpm(0), 0);
        game.cleanup();
    });

    it('is 0 wpm before the clock starts', () => {
        const game = newGame();
        assert.deepEqual(game.getStateForPlayer(0).wpm, [0, 0]);
        game.cleanup();
    });
});

describe('Typing malformed moves', () => {
    it('rejects bad input without throwing', () => {
        const game = startedGame();
        const bad = [undefined, null, {}, [], 'The', 3, 1.5, { text: 3 }, { text: null }, { text: ['T'] },
            { text: 'x'.repeat(401) }, { word: 'The' }];
        for (const move of bad) {
            let result;
            assert.doesNotThrow(() => { result = game.makeMove(0, move); });
            assert.equal(result.valid, false, `should reject ${JSON.stringify(move)}`);
            assert.equal(typeof result.message, 'string');
        }
        assert.equal(game.makeMove(0, { text: 'x'.repeat(400) }).valid, true, '400 chars is allowed');
        assert.equal(game.progress[0], 0);
        assert.equal(game.hasError[0], true);
        assert.equal(game.makeMove(2, { text: 'The' }).valid, false);
        game.cleanup();
    });
});

describe('Typing state', () => {
    it('exposes the same full state to both players', () => {
        const game = startedGame();
        game.makeMove(0, { text: 'The' });
        const s0 = game.getStateForPlayer(0);
        const s1 = game.getStateForPlayer(1);
        assert.deepEqual(s0, s1);
        assert.equal(s0.sentence, SENTENCE);
        assert.deepEqual(s0.progress, [3, 0]);
        assert.deepEqual(s0.hasError, [false, false]);
        assert.equal(s0.timeLimit, 120);
        assert.equal(s0.started, true);
        assert.equal(s0.paused, false);
        assert.equal(s0.activePlayerIndex, null);
        assert.equal(s0.isGameOver, false);
        assert.equal(s0.winner, null);
        game.cleanup();
    });
});
