const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Sim = require('../games/sim');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

function newGame(start = 0) {
    return new Sim('r', [fakeSocket('a'), fakeSocket('b')], start);
}

describe('Sim', () => {
    it('starts with 15 free edges and honors the starting player', () => {
        const game = newGame(1);
        const s = game.getState();
        assert.equal(s.edges.length, 0);
        assert.equal(s.edgesLeft, 15);
        assert.equal(s.losingTriangle, null);
        assert.equal(s.activePlayerIndex, 1);
        assert.equal(game.makeMove(0, { a: 0, b: 1 }).valid, false);
        assert.equal(game.makeMove(1, { a: 0, b: 1 }).valid, true);
    });

    it('normalizes a > b and records the owner', () => {
        const game = newGame(0);
        assert.equal(game.makeMove(0, { a: 4, b: 2 }).valid, true);
        const s = game.getState();
        assert.deepEqual(s.edges, [{ a: 2, b: 4, owner: 0 }]);
        assert.equal(s.matrix[2][4], 0);
        assert.equal(s.matrix[4][2], 0);
        assert.deepEqual(s.lastMove, { a: 2, b: 4, owner: 0 });
        assert.equal(s.activePlayerIndex, 1);
    });

    it('rejects a taken edge in either orientation', () => {
        const game = newGame(0);
        game.makeMove(0, { a: 0, b: 1 });
        const r = game.makeMove(1, { a: 1, b: 0 });
        assert.equal(r.valid, false);
        assert.match(r.message, /taken/);
        assert.equal(game.activePlayerIndex, 1);
    });

    it('rejects self-loops, out of range, and malformed moves without throwing', () => {
        const game = newGame(0);
        const bad = [
            undefined, null, 42, 'ab', [], {}, { a: 0 }, { b: 1 }, { a: 0, b: 0 }, { a: 3, b: 3 },
            { a: -1, b: 2 }, { a: 0, b: 6 }, { a: 1.5, b: 2 }, { a: '0', b: 1 }, { a: 0, b: '1' },
            { a: NaN, b: 1 }, { a: Infinity, b: 1 }, { a: true, b: 1 }
        ];
        for (const m of bad) {
            let r;
            assert.doesNotThrow(() => { r = game.makeMove(0, m); });
            assert.equal(r.valid, false, `expected invalid for ${JSON.stringify(m)}`);
            assert.equal(typeof r.message, 'string');
        }
        assert.equal(game.getState().edges.length, 0);
        assert.equal(game.activePlayerIndex, 0);
    });

    it('rejects moves out of turn', () => {
        const game = newGame(0);
        assert.equal(game.makeMove(1, { a: 0, b: 1 }).message, 'Not your turn');
    });

    it('the player who completes a triangle of their own color loses', () => {
        const game = newGame(0);
        // P0 builds 0-1, 1-2; P1 plays elsewhere; P0 closes 0-2 -> triangle 0,1,2 -> P0 loses.
        assert.equal(game.makeMove(0, { a: 0, b: 1 }).valid, true);
        assert.equal(game.makeMove(1, { a: 3, b: 4 }).valid, true);
        assert.equal(game.makeMove(0, { a: 1, b: 2 }).valid, true);
        assert.equal(game.makeMove(1, { a: 4, b: 5 }).valid, true);
        assert.equal(game.isGameOver, false);
        assert.equal(game.makeMove(0, { a: 0, b: 2 }).valid, true);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 1);
        assert.deepEqual(game.getState().losingTriangle, [0, 1, 2]);
    });

    it('a mixed-color triangle does not end the game', () => {
        const game = newGame(0);
        game.makeMove(0, { a: 0, b: 1 });
        game.makeMove(1, { a: 1, b: 2 });
        game.makeMove(0, { a: 0, b: 2 }); // 0-1 (P0), 1-2 (P1), 0-2 (P0): not monochrome
        assert.equal(game.isGameOver, false);
        assert.equal(game.getState().losingTriangle, null);
        assert.equal(game.activePlayerIndex, 1);
    });

    it('refuses moves after the game ends', () => {
        const game = newGame(0);
        game.makeMove(0, { a: 0, b: 1 });
        game.makeMove(1, { a: 3, b: 4 });
        game.makeMove(0, { a: 1, b: 2 });
        game.makeMove(1, { a: 4, b: 5 });
        game.makeMove(0, { a: 0, b: 2 });
        assert.equal(game.isGameOver, true);
        const r = game.makeMove(1, { a: 3, b: 5 });
        assert.equal(r.valid, false);
        assert.equal(game.getState().edges.length, 5);
    });

    it('never reaches a draw: any full sequence of legal moves ends by move 15 with a triangle', () => {
        // Play every possible ordering deterministically a few different ways (random legal play, seeded).
        let seed = 12345;
        const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        for (let trial = 0; trial < 200; trial++) {
            const game = newGame(trial % 2);
            let moves = 0;
            while (!game.isGameOver) {
                const free = [];
                for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) if (game.owner[a][b] === null) free.push([a, b]);
                assert.ok(free.length > 0, 'ran out of edges without a result');
                const [a, b] = free[Math.floor(rnd() * free.length)];
                assert.equal(game.makeMove(game.activePlayerIndex, { a, b }).valid, true);
                moves++;
            }
            assert.ok(moves <= 15);
            assert.notEqual(game.winner, 'draw');
            assert.ok(game.winner === 0 || game.winner === 1);
            const tri = game.getState().losingTriangle;
            assert.equal(tri.length, 3);
            const loser = 1 - game.winner;
            assert.equal(game.owner[tri[0]][tri[1]], loser);
            assert.equal(game.owner[tri[1]][tri[2]], loser);
            assert.equal(game.owner[tri[0]][tri[2]], loser);
        }
    });

    it('getState returns copies, not live references', () => {
        const game = newGame(0);
        game.makeMove(0, { a: 0, b: 1 });
        const s = game.getState();
        s.edges.push({ a: 2, b: 3, owner: 1 });
        s.matrix[2][3] = 1;
        assert.equal(game.getState().edges.length, 1);
        assert.equal(game.getState().matrix[2][3], null);
    });

    it('getStateForPlayer matches the public state (no hidden info in Sim)', () => {
        const game = newGame(0);
        game.makeMove(0, { a: 0, b: 5 });
        assert.deepEqual(game.getStateForPlayer(0), game.getState());
        assert.deepEqual(game.getStateForPlayer(1), game.getState());
    });
});
