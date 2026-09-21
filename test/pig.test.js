const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const Pig = require('../games/pig');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

function newGame(start = 0) {
    return new Pig('r', [fakeSocket('a'), fakeSocket('b')], start);
}

const realRandom = Math.random;
function stubRolls(faces) {
    const queue = [...faces];
    Math.random = () => {
        if (queue.length === 0) throw new Error('test asked for more rolls than were queued');
        const v = queue.shift();
        return (v - 0.5) / 6;
    };
    return queue;
}
afterEach(() => { Math.random = realRandom; });

const ROLL = { action: 'roll' };
const HOLD = { action: 'hold' };

describe('Pig', () => {
    it('starts at 0-0 with target 50 and honors the starting player', () => {
        const game = newGame(1);
        const s = game.getState();
        assert.deepEqual(s.scores, [0, 0]);
        assert.equal(s.turnTotal, 0);
        assert.equal(s.target, 50);
        assert.equal(s.lastRoll, null);
        assert.deepEqual(s.history, []);
        assert.equal(s.activePlayerIndex, 1);
        assert.equal(s.isGameOver, false);
        assert.equal(game.makeMove(0, ROLL).valid, false);
    });

    it('rolls 2-6 add to the turn total and keep the turn', () => {
        stubRolls([4, 6, 2]);
        const game = newGame(0);
        game.makeMove(0, ROLL);
        assert.equal(game.turnTotal, 4);
        assert.equal(game.activePlayerIndex, 0);
        assert.deepEqual(game.getState().lastRoll, { player: 0, value: 4, busted: false });
        game.makeMove(0, ROLL);
        game.makeMove(0, ROLL);
        assert.equal(game.turnTotal, 12);
        assert.deepEqual(game.scores, [0, 0]);
        assert.equal(game.activePlayerIndex, 0);
        assert.equal(game.getState().history.length, 3);
    });

    it('rolling a 1 busts: turn total wiped, turn ends, banked score untouched', () => {
        stubRolls([5, 5, 1]);
        const game = newGame(0);
        game.scores[0] = 20;
        game.makeMove(0, ROLL);
        game.makeMove(0, ROLL);
        assert.equal(game.turnTotal, 10);
        game.makeMove(0, ROLL);
        const s = game.getState();
        assert.equal(s.turnTotal, 0);
        assert.deepEqual(s.scores, [20, 0]);
        assert.equal(s.activePlayerIndex, 1);
        assert.deepEqual(s.lastRoll, { player: 0, value: 1, busted: true });
        assert.equal(s.lastAction.type, 'bust');
    });

    it('hold banks the turn total and passes the turn', () => {
        stubRolls([3, 4]);
        const game = newGame(0);
        game.makeMove(0, ROLL);
        game.makeMove(0, ROLL);
        assert.equal(game.makeMove(0, HOLD).valid, true);
        const s = game.getState();
        assert.deepEqual(s.scores, [7, 0]);
        assert.equal(s.turnTotal, 0);
        assert.equal(s.activePlayerIndex, 1);
        assert.equal(s.isGameOver, false);
        assert.deepEqual(s.lastAction, { player: 0, type: 'hold', value: 7 });
        // lastRoll stays as the last die shown
        assert.deepEqual(s.lastRoll, { player: 0, value: 4, busted: false });
    });

    it('holding with nothing to bank is rejected and the turn continues', () => {
        const game = newGame(0);
        const r = game.makeMove(0, HOLD);
        assert.equal(r.valid, false);
        assert.match(r.message, /Roll/);
        assert.equal(game.activePlayerIndex, 0);
        assert.deepEqual(game.scores, [0, 0]);
    });

    it('the win is only checked on hold, not when a roll takes score + turnTotal past 50', () => {
        stubRolls([6, 6]);
        const game = newGame(0);
        game.scores[0] = 45;
        game.makeMove(0, ROLL); // 45 + 6 = 51 potential, but not banked
        assert.equal(game.isGameOver, false);
        assert.equal(game.activePlayerIndex, 0);
        game.makeMove(0, ROLL);
        assert.equal(game.isGameOver, false);
        assert.equal(game.turnTotal, 12);
        assert.equal(game.makeMove(0, HOLD).valid, true);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 0);
        assert.deepEqual(game.scores, [57, 0]);
    });

    it('a bust with a would-be-winning turn total does not win', () => {
        stubRolls([6, 1]);
        const game = newGame(1);
        game.scores[1] = 48;
        game.makeMove(1, ROLL);
        game.makeMove(1, ROLL);
        assert.equal(game.isGameOver, false);
        assert.deepEqual(game.scores, [0, 48]);
        assert.equal(game.activePlayerIndex, 0);
    });

    it('reaching exactly 50 on hold wins', () => {
        stubRolls([5]);
        const game = newGame(0);
        game.scores[0] = 45;
        game.makeMove(0, ROLL);
        game.makeMove(0, HOLD);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 0);
        assert.equal(game.scores[0], 50);
    });

    it('refuses moves after the game is over', () => {
        stubRolls([5]);
        const game = newGame(0);
        game.scores[0] = 45;
        game.makeMove(0, ROLL);
        game.makeMove(0, HOLD);
        assert.equal(game.makeMove(1, ROLL).valid, false);
        assert.equal(game.makeMove(0, ROLL).valid, false);
        assert.deepEqual(game.scores, [50, 0]);
    });

    it('rejects out-of-turn and malformed moves without throwing', () => {
        const game = newGame(0);
        assert.equal(game.makeMove(1, ROLL).message, 'Not your turn');
        const bad = [undefined, null, 3, 'roll', [], {}, { action: 'ROLL' }, { action: 'Hold' }, { action: 'pass' }, { action: 2 }, { action: null }, { action: ['roll'] }];
        for (const m of bad) {
            let r;
            assert.doesNotThrow(() => { r = game.makeMove(0, m); });
            assert.equal(r.valid, false, `expected invalid for ${JSON.stringify(m)}`);
            assert.equal(typeof r.message, 'string');
        }
        assert.equal(game.turnTotal, 0);
        assert.deepEqual(game.scores, [0, 0]);
        assert.equal(game.activePlayerIndex, 0);
        assert.equal(game.getState().history.length, 0);
    });

    it('history keeps only the most recent entries', () => {
        stubRolls(new Array(12).fill(2));
        const game = newGame(0);
        for (let i = 0; i < 12; i++) game.makeMove(0, ROLL);
        const s = game.getState();
        assert.equal(s.history.length, game.historyLimit);
        assert.equal(s.turnTotal, 24);
    });

    it('plays a full deterministic game to a win', () => {
        // P0: 6,6,6 hold (18). P1: 4,1 bust. P0: 5,5,5 hold (33). P1: 6,6 hold (12). P0: 6,6,6 hold (51) -> win
        stubRolls([6, 6, 6, 4, 1, 5, 5, 5, 6, 6, 6, 6, 6]);
        const game = newGame(0);
        game.makeMove(0, ROLL); game.makeMove(0, ROLL); game.makeMove(0, ROLL); game.makeMove(0, HOLD);
        assert.deepEqual(game.scores, [18, 0]);
        game.makeMove(1, ROLL); game.makeMove(1, ROLL);
        assert.deepEqual(game.scores, [18, 0]);
        assert.equal(game.activePlayerIndex, 0);
        game.makeMove(0, ROLL); game.makeMove(0, ROLL); game.makeMove(0, ROLL); game.makeMove(0, HOLD);
        assert.deepEqual(game.scores, [33, 0]);
        game.makeMove(1, ROLL); game.makeMove(1, ROLL); game.makeMove(1, HOLD);
        assert.deepEqual(game.scores, [33, 12]);
        game.makeMove(0, ROLL); game.makeMove(0, ROLL); game.makeMove(0, ROLL);
        assert.equal(game.isGameOver, false);
        game.makeMove(0, HOLD);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 0);
        assert.deepEqual(game.scores, [51, 12]);
    });

    it('random play with a hold-at-20 strategy always ends with a single winner (no draw)', () => {
        Math.random = realRandom;
        for (let trial = 0; trial < 30; trial++) {
            const game = newGame(trial % 2);
            let guard = 0;
            while (!game.isGameOver && guard++ < 10000) {
                const p = game.activePlayerIndex;
                const move = game.turnTotal >= 20 ? HOLD : ROLL;
                assert.equal(game.makeMove(p, move).valid, true);
            }
            assert.equal(game.isGameOver, true);
            assert.ok(game.winner === 0 || game.winner === 1);
            assert.ok(game.scores[game.winner] >= 50);
            assert.ok(game.scores[1 - game.winner] < 50);
        }
    });

    it('getStateForPlayer matches the public state and returns copies', () => {
        stubRolls([3]);
        const game = newGame(0);
        game.makeMove(0, ROLL);
        const s = game.getStateForPlayer(1);
        assert.deepEqual(s, game.getState());
        s.scores[0] = 99;
        s.history.push({ player: 0, type: 'hold', value: 1 });
        assert.equal(game.scores[0], 0);
        assert.equal(game.history.length, 1);
    });
});
