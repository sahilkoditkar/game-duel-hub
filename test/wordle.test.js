const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Wordle = require('../games/wordle');
const { calculateFeedback, FIVE_LETTER_WORDS } = Wordle;
const { WORDS } = require('../games/wordchain');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

function newGame(secret) {
    const game = new Wordle('r', [fakeSocket('a'), fakeSocket('b')], 0);
    if (secret) game.secret = secret;
    return game;
}

// Six valid 5-letter words that are never the test secret ('zebra').
const WRONG = ['about', 'above', 'abuse', 'actor', 'adapt', 'admit'];

describe('Wordle setup', () => {
    it('picks a 5-letter secret from the word list and is simultaneous', () => {
        const game = newGame();
        assert.equal(game.secret.length, 5);
        assert.equal(WORDS.has(game.secret), true);
        assert.equal(FIVE_LETTER_WORDS.length > 500, true);
        assert.equal(game.getStateForPlayer(0).activePlayerIndex, null);
        assert.equal(game.getStateForPlayer(1).activePlayerIndex, null);
    });
});

describe('Wordle feedback', () => {
    it('marks exact, present and absent letters', () => {
        assert.deepEqual(calculateFeedback('zebra', 'zebra'), [2, 2, 2, 2, 2]);
        assert.deepEqual(calculateFeedback('zebra', 'bread'), [1, 1, 1, 1, 0]);
        assert.deepEqual(calculateFeedback('zebra', 'quilt'), [0, 0, 0, 0, 0]);
    });

    it('handles duplicate letters like Wordle', () => {
        // secret has two b's: both b's in the guess get credit
        assert.deepEqual(calculateFeedback('abbey', 'babes'), [1, 1, 2, 2, 0]);
        // secret has one e: only the first unmatched e in the guess is yellow
        assert.deepEqual(calculateFeedback('abbey', 'keeps'), [0, 1, 0, 0, 0]);
        // exact match takes priority over a present match elsewhere
        // secret has two l's: the exact match at index 2 and the first stray l (index 0) get credit, the third l does not
        assert.deepEqual(calculateFeedback('allow', 'lulls'), [1, 0, 2, 0, 0]);
    });
});

describe('Wordle play', () => {
    it('the first player to guess the secret wins immediately', () => {
        const game = newGame('zebra');
        assert.equal(game.makeMove(0, { word: 'about' }).valid, true);
        assert.equal(game.makeMove(1, { word: 'bread' }).valid, true);
        assert.equal(game.isGameOver, false);
        assert.equal(game.makeMove(1, { word: 'ZEBRA ' }).valid, true, 'trims and lowercases');
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 1);
        assert.deepEqual(game.solved, [false, true]);
        const r = game.makeMove(0, { word: 'zebra' });
        assert.equal(r.valid, false);
        assert.match(r.message, /over/i);
    });

    it('a player is out after 6 misses, may not guess again, and both out is a draw', () => {
        const game = newGame('zebra');
        WRONG.forEach(w => assert.equal(game.makeMove(0, { word: w }).valid, true));
        assert.equal(game.out[0], true);
        assert.equal(game.isGameOver, false, 'opponent still has guesses');
        const r = game.makeMove(0, { word: 'zebra' });
        assert.equal(r.valid, false);
        assert.match(r.message, /no guesses/i);

        // Opponent keeps guessing while player 0 is out.
        WRONG.slice(0, 5).forEach(w => assert.equal(game.makeMove(1, { word: w }).valid, true));
        assert.equal(game.isGameOver, false);
        assert.equal(game.makeMove(1, { word: 'adopt' }).valid, true);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 'draw');
        assert.deepEqual(game.out, [true, true]);
    });

    it('an out player can still lose to a late solve', () => {
        const game = newGame('zebra');
        WRONG.forEach(w => game.makeMove(0, { word: w }));
        assert.equal(game.makeMove(1, { word: 'zebra' }).valid, true);
        assert.equal(game.winner, 1);
    });

    it('records feedback with each guess', () => {
        const game = newGame('zebra');
        game.makeMove(0, { word: 'bread' });
        assert.deepEqual(game.guesses[0], [{ word: 'bread', feedback: [1, 1, 1, 1, 0] }]);
    });
});

describe('Wordle malformed moves', () => {
    it('rejects bad input without throwing', () => {
        const game = newGame('zebra');
        const bad = [undefined, null, {}, [], 'zebra', 42, { word: 42 }, { word: null }, { word: ['z', 'e', 'b', 'r', 'a'] },
            { word: '' }, { word: 'zeb' }, { word: 'zebras' }, { word: 'zebr4' }, { word: 'ze bra' }, { word: 1.5 }];
        for (const move of bad) {
            let result;
            assert.doesNotThrow(() => { result = game.makeMove(0, move); });
            assert.equal(result.valid, false, `should reject ${JSON.stringify(move)}`);
            assert.equal(typeof result.message, 'string');
        }
        assert.equal(game.guesses[0].length, 0);
    });

    it('rejects words not in the list with a clear message', () => {
        const game = newGame('zebra');
        const r = game.makeMove(0, { word: 'qzxwv' });
        assert.equal(r.valid, false);
        assert.equal(r.message, 'Not in word list');
    });

    it('rejects unknown player indexes', () => {
        const game = newGame('zebra');
        assert.equal(game.makeMove(2, { word: 'zebra' }).valid, false);
        assert.equal(game.makeMove('0', { word: 'zebra' }).valid, false);
    });
});

describe('Wordle hidden information', () => {
    it('never sends the secret or the opponent letters before the game ends', () => {
        const game = newGame('zebra');
        game.makeMove(0, { word: 'bread' });
        const p1 = game.getStateForPlayer(1);
        assert.equal(p1.secret, null);
        assert.deepEqual(p1.myGuesses, []);
        assert.deepEqual(p1.opponentFeedback, [[1, 1, 1, 1, 0]]);
        assert.equal(p1.oppGuessCount, 1);
        assert.equal(p1.myGuessCount, 0);
        assert.equal(p1.maxGuesses, 6);
        assert.doesNotMatch(JSON.stringify(p1), /bread|zebra/);

        const p0 = game.getStateForPlayer(0);
        assert.deepEqual(p0.myGuesses, [{ word: 'bread', feedback: [1, 1, 1, 1, 0] }]);
        assert.equal(p0.secret, null);

        assert.doesNotMatch(JSON.stringify(game.getState()), /bread|zebra/);
    });

    it('reveals the secret to both once the game is over', () => {
        const game = newGame('zebra');
        game.makeMove(0, { word: 'zebra' });
        assert.equal(game.getStateForPlayer(0).secret, 'zebra');
        assert.equal(game.getStateForPlayer(1).secret, 'zebra');
        assert.equal(game.getStateForPlayer(1).isGameOver, true);
        assert.equal(game.getStateForPlayer(1).winner, 0);
    });
});
