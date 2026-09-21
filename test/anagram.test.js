const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Anagram = require('../games/anagram');
const { canForm, formableWords } = Anagram;
const { WORDS } = require('../games/wordchain');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

// Deterministic rack for scoring tests: r a t e s l i n p
const RACK = ['r', 'a', 't', 'e', 's', 'l', 'i', 'n', 'p'];

function newGame(letters) {
    const game = new Anagram('r', [fakeSocket('a'), fakeSocket('b')], 0);
    if (letters) game.letters = letters.slice();
    return game;
}

function startedGame(letters) {
    const game = newGame(letters);
    game.start();
    return game;
}

describe('Anagram letters', () => {
    it('draws 9 lowercase letters with 3-4 vowels and at least 12 formable words', () => {
        for (let i = 0; i < 5; i++) {
            const game = newGame();
            assert.equal(game.letters.length, 9);
            assert.match(game.letters.join(''), /^[a-z]{9}$/);
            const vowels = game.letters.filter(ch => 'aeiou'.includes(ch)).length;
            assert.equal(vowels >= 3 && vowels <= 4, true, `vowel count ${vowels}`);
            const playable = formableWords(game.letters);
            assert.equal(playable.length >= 12, true, `only ${playable.length} words`);
            assert.equal(playable.every(w => WORDS.has(w) && w.length >= 3), true);
            game.cleanup();
        }
    });

    it('respects letter counts when checking formability', () => {
        assert.equal(canForm('rat', RACK), true);
        assert.equal(canForm('plate', RACK), true);
        assert.equal(canForm('tree', RACK), false, 'only one e available');
        assert.equal(canForm('apple', RACK), false, 'only one p available');
        assert.equal(canForm('zap', RACK), false);
    });
});

describe('Anagram clock', () => {
    it('does not start a timer in the constructor and rejects moves before start()', () => {
        const game = newGame(RACK);
        assert.equal(game.timer, null);
        assert.equal(game.started, false);
        const s = game.getStateForPlayer(0);
        assert.equal(s.started, false);
        assert.equal(s.timeLeft, 60);
        const r = game.makeMove(0, { word: 'rat' });
        assert.equal(r.valid, false);
        assert.match(r.message, /clock/i);
        game.cleanup();
    });

    it('start/pause/resume/cleanup control the interval', () => {
        const game = newGame(RACK);
        game.start();
        assert.equal(game.started, true);
        assert.notEqual(game.timer, null);
        game.start(); // idempotent
        assert.notEqual(game.timer, null);

        game.pause();
        assert.equal(game.timer, null);
        assert.equal(game.paused, true);
        assert.equal(game.getStateForPlayer(0).paused, true);
        const r = game.makeMove(0, { word: 'rat' });
        assert.equal(r.valid, false);
        assert.match(r.message, /paused/i);

        game.resume();
        assert.equal(game.paused, false);
        assert.notEqual(game.timer, null);
        assert.equal(game.makeMove(0, { word: 'rat' }).valid, true);

        game.cleanup();
        assert.equal(game.timer, null);
    });

    it('pause and resume are no-ops before start', () => {
        const game = newGame(RACK);
        game.pause();
        assert.equal(game.paused, false);
        game.resume();
        assert.equal(game.timer, null);
        game.cleanup();
    });

    it('counts down and ends the game at zero with the higher score winning', () => {
        const game = startedGame(RACK);
        game.makeMove(0, { word: 'rat' });   // 3
        game.makeMove(1, { word: 'plate' }); // 5
        game.timeLeft = 2;
        game.tick();
        assert.equal(game.timeLeft, 1);
        assert.equal(game.isGameOver, false);
        game.tick();
        assert.equal(game.timeLeft, 0);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 1);
        assert.equal(game.timer, null, 'interval cleared when the round ends');
        assert.equal(game.makeMove(0, { word: 'plate' }).valid, false);
        game.cleanup();
    });

    it('equal scores at the end are a draw', () => {
        const game = startedGame(RACK);
        game.makeMove(0, { word: 'rat' });
        game.makeMove(1, { word: 'rat' }); // both may find the same word
        game.timeLeft = 1;
        game.tick();
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 'draw');
        game.cleanup();
    });
});

describe('Anagram scoring and rules', () => {
    it('scores a word by its length and tracks each player separately', () => {
        const game = startedGame(RACK);
        assert.equal(game.makeMove(0, { word: 'rat' }).valid, true);
        assert.equal(game.makeMove(0, { word: ' RATE ' }).valid, true, 'trims and lowercases');
        assert.equal(game.makeMove(0, { word: 'plate' }).valid, true);
        assert.deepEqual(game.scores, [12, 0]);
        const s0 = game.getStateForPlayer(0);
        assert.deepEqual(s0.myWords, [{ word: 'rat', points: 3 }, { word: 'rate', points: 4 }, { word: 'plate', points: 5 }]);
        assert.equal(s0.myScore, 12);
        assert.equal(s0.oppScore, 0);
        assert.equal(s0.oppWordCount, 0);
        game.cleanup();
    });

    it('rejects repeats by the same player but lets the opponent find the same word', () => {
        const game = startedGame(RACK);
        assert.equal(game.makeMove(0, { word: 'rat' }).valid, true);
        const r = game.makeMove(0, { word: 'rat' });
        assert.equal(r.valid, false);
        assert.match(r.message, /already/i);
        assert.equal(game.makeMove(1, { word: 'rat' }).valid, true);
        assert.deepEqual(game.scores, [3, 3]);
        game.cleanup();
    });

    it('rejects words that cannot be built from the rack or are not in the list', () => {
        const game = startedGame(RACK);
        let r = game.makeMove(0, { word: 'tree' });
        assert.equal(r.valid, false);
        assert.match(r.message, /letters/i);
        r = game.makeMove(0, { word: 'zap' });
        assert.equal(r.valid, false);
        r = game.makeMove(0, { word: 'sart' });
        assert.equal(r.valid, false);
        assert.equal(r.message, 'Not in word list');
        r = game.makeMove(0, { word: 'at' });
        assert.equal(r.valid, false);
        assert.match(r.message, /3 letters/i);
        assert.deepEqual(game.scores, [0, 0]);
        game.cleanup();
    });

    it('rejects malformed moves without throwing', () => {
        const game = startedGame(RACK);
        const bad = [undefined, null, {}, [], 'rat', 7, 1.5, { word: 3 }, { word: null }, { word: ['r', 'a', 't'] },
            { word: '' }, { word: 'ra t' }, { word: 'r4t' }, { word: 'rat!' }];
        for (const move of bad) {
            let result;
            assert.doesNotThrow(() => { result = game.makeMove(0, move); });
            assert.equal(result.valid, false, `should reject ${JSON.stringify(move)}`);
            assert.equal(typeof result.message, 'string');
        }
        assert.equal(game.makeMove(2, { word: 'rat' }).valid, false);
        assert.deepEqual(game.scores, [0, 0]);
        game.cleanup();
    });
});

describe('Anagram hidden information', () => {
    it('hides the opponent word list until the game is over', () => {
        const game = startedGame(RACK);
        game.makeMove(1, { word: 'plate' });
        const s0 = game.getStateForPlayer(0);
        assert.equal(s0.oppWordCount, 1);
        assert.equal(s0.oppScore, 5);
        assert.equal(s0.allWords, undefined);
        assert.doesNotMatch(JSON.stringify(s0), /plate/);
        assert.equal(s0.letters, RACK.join(''));
        assert.equal(s0.activePlayerIndex, null);
        assert.doesNotMatch(JSON.stringify(game.getState()), /plate/);

        game.timeLeft = 1;
        game.tick();
        const over = game.getStateForPlayer(0);
        assert.deepEqual(over.allWords, [[], [{ word: 'plate', points: 5 }]]);
        assert.equal(over.isGameOver, true);
        assert.equal(over.winner, 1);
        game.cleanup();
    });
});
