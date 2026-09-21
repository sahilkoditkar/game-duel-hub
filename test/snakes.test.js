const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const Snakes = require('../games/snakes');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

function newGame(start = 0) {
    return new Snakes('r', [fakeSocket('a'), fakeSocket('b')], start);
}

// Deterministic dice: queue the die faces you want; 1 + floor(random * 6) yields exactly that face.
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

describe('Snakes and Ladders', () => {
    it('starts both players off the board with the fixed maps in state', () => {
        const game = newGame(1);
        const s = game.getState();
        assert.deepEqual(s.positions, [0, 0]);
        assert.equal(s.lastRoll, null);
        assert.equal(s.target, 100);
        assert.equal(s.activePlayerIndex, 1);
        assert.equal(s.ladders[3], 22);
        assert.equal(s.ladders[80], 99);
        assert.equal(s.snakes[98], 79);
        assert.equal(Object.keys(s.ladders).length, 9);
        assert.equal(Object.keys(s.snakes).length, 10);
    });

    it('the die produces every face 1-6 and nothing else', () => {
        const game = newGame(0);
        const seen = new Set();
        for (let i = 0; i < 600; i++) {
            const v = game.rollDie();
            assert.ok(Number.isInteger(v) && v >= 1 && v <= 6, `bad face ${v}`);
            seen.add(v);
        }
        assert.equal(seen.size, 6);
        // Boundary check of the stub itself
        stubRolls([1, 6]);
        assert.equal(game.rollDie(), 1);
        assert.equal(game.rollDie(), 6);
    });

    it('a plain roll moves the token and passes the turn', () => {
        stubRolls([4]);
        const game = newGame(0);
        assert.equal(game.makeMove(0, ROLL).valid, true);
        const s = game.getState();
        assert.deepEqual(s.positions, [4, 0]);
        assert.equal(s.activePlayerIndex, 1);
        assert.equal(s.isGameOver, false);
        assert.deepEqual({ ...s.lastRoll, n: undefined }, { player: 0, value: 4, from: 0, to: 4, via: null, bonus: false, n: undefined });
    });

    it('landing on a ladder foot climbs to its top', () => {
        stubRolls([3]);
        const game = newGame(0);
        game.makeMove(0, ROLL);
        const s = game.getState();
        assert.equal(s.positions[0], 22);
        assert.equal(s.lastRoll.via, 'ladder');
        assert.equal(s.lastRoll.from, 0);
        assert.equal(s.lastRoll.to, 22);
    });

    it('landing on a snake head slides to its tail', () => {
        const game = newGame(0);
        game.positions[0] = 12;
        stubRolls([5]); // 12 + 5 = 17 -> snake -> 4
        game.makeMove(0, ROLL);
        const s = game.getState();
        assert.equal(s.positions[0], 4);
        assert.equal(s.lastRoll.via, 'snake');
        assert.equal(s.lastRoll.from, 12);
        assert.equal(s.lastRoll.to, 4);
        assert.equal(s.activePlayerIndex, 1);
    });

    it('rolling a 6 grants another turn, chaining bonuses', () => {
        stubRolls([6, 6, 2]);
        const game = newGame(0);
        game.makeMove(0, ROLL);
        assert.equal(game.activePlayerIndex, 0);
        assert.equal(game.getState().lastRoll.bonus, true);
        assert.equal(game.positions[0], 6);
        game.makeMove(0, ROLL);
        assert.equal(game.activePlayerIndex, 0);
        assert.equal(game.positions[0], 12);
        game.makeMove(0, ROLL);
        assert.equal(game.positions[0], 14);
        assert.equal(game.getState().lastRoll.bonus, false);
        assert.equal(game.activePlayerIndex, 1);
    });

    it('a roll that would overshoot 100 does not move but still ends the turn', () => {
        const game = newGame(0);
        game.positions[0] = 97;
        stubRolls([4]);
        game.makeMove(0, ROLL);
        const s = game.getState();
        assert.equal(s.positions[0], 97);
        assert.equal(s.lastRoll.from, 97);
        assert.equal(s.lastRoll.to, 97);
        assert.equal(s.lastRoll.via, null);
        assert.equal(s.activePlayerIndex, 1);
        assert.equal(s.isGameOver, false);
    });

    it('an overshooting 6 still grants the bonus roll', () => {
        const game = newGame(0);
        game.positions[0] = 97;
        stubRolls([6]);
        game.makeMove(0, ROLL);
        assert.equal(game.positions[0], 97);
        assert.equal(game.getState().lastRoll.bonus, true);
        assert.equal(game.activePlayerIndex, 0);
    });

    it('exactly reaching 100 wins immediately, even on a 6 (no bonus)', () => {
        const game = newGame(1);
        game.positions[1] = 94;
        stubRolls([6]);
        assert.equal(game.makeMove(1, ROLL).valid, true);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 1);
        assert.equal(game.positions[1], 100);
        assert.equal(game.getState().lastRoll.bonus, false);
        assert.equal(game.makeMove(0, ROLL).valid, false);
    });

    it('reaching 100 via the 80->99 ladder does not win; 98 is a snake back to 79', () => {
        const game = newGame(0);
        game.positions[0] = 78;
        stubRolls([2]); // 80 -> ladder -> 99
        game.makeMove(0, ROLL);
        assert.equal(game.positions[0], 99);
        assert.equal(game.isGameOver, false);
        game.positions[0] = 96;
        game.activePlayerIndex = 0;
        stubRolls([2]); // 98 -> snake -> 79
        game.makeMove(0, ROLL);
        assert.equal(game.positions[0], 79);
        assert.equal(game.getState().lastRoll.via, 'snake');
    });

    it('rejects moves out of turn and malformed moves without throwing', () => {
        const game = newGame(0);
        assert.equal(game.makeMove(1, ROLL).message, 'Not your turn');
        const bad = [undefined, null, 5, 'roll', [], {}, { action: 'hold' }, { action: 'ROLL' }, { action: 1 }, { action: null }, { roll: true }];
        for (const m of bad) {
            let r;
            assert.doesNotThrow(() => { r = game.makeMove(0, m); });
            assert.equal(r.valid, false, `expected invalid for ${JSON.stringify(m)}`);
            assert.equal(typeof r.message, 'string');
        }
        assert.deepEqual(game.positions, [0, 0]);
        assert.equal(game.getState().lastRoll, null);
        assert.equal(game.activePlayerIndex, 0);
    });

    it('plays a full deterministic (seeded) game to a win with no draw possible', () => {
        let seed = 987654321;
        Math.random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
        const game = newGame(0);
        let moves = 0;
        const seenVia = new Set();
        while (!game.isGameOver && moves < 5000) {
            const p = game.activePlayerIndex;
            assert.equal(game.makeMove(p, ROLL).valid, true);
            const lr = game.getState().lastRoll;
            assert.ok(lr.value >= 1 && lr.value <= 6);
            if (lr.via) seenVia.add(lr.via);
            assert.ok(game.positions[0] >= 0 && game.positions[0] <= 100);
            assert.ok(game.positions[1] >= 0 && game.positions[1] <= 100);
            moves++;
        }
        assert.equal(game.isGameOver, true);
        assert.ok(game.winner === 0 || game.winner === 1);
        assert.notEqual(game.winner, 'draw');
        assert.equal(game.positions[game.winner], 100);
        assert.notEqual(game.positions[1 - game.winner], 100);
        assert.ok(seenVia.has('ladder') || seenVia.has('snake'));
    });

    it('random play always terminates with exactly one player on 100', () => {
        Math.random = realRandom;
        for (let trial = 0; trial < 30; trial++) {
            const game = newGame(trial % 2);
            let guard = 0;
            while (!game.isGameOver && guard++ < 5000) {
                assert.equal(game.makeMove(game.activePlayerIndex, ROLL).valid, true);
            }
            assert.equal(game.isGameOver, true);
            assert.equal(game.positions[game.winner], 100);
        }
    });

    it('getStateForPlayer matches the public state and does not share arrays', () => {
        const game = newGame(0);
        const s = game.getStateForPlayer(1);
        assert.deepEqual(s, game.getState());
        s.positions[0] = 50;
        s.ladders[3] = 99;
        assert.equal(game.positions[0], 0);
        assert.equal(Snakes.LADDERS[3], 22);
    });
});
