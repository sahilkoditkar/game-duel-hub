const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Chomp = require('../games/chomp');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

function newGame(start = 0) {
    return new Chomp('r', [fakeSocket('a'), fakeSocket('b')], start);
}

function countPresent(grid) {
    return grid.reduce((n, row) => n + row.filter(Boolean).length, 0);
}

describe('Chomp', () => {
    it('starts as a full 4x7 bar with the poison present', () => {
        const game = newGame(1);
        const s = game.getState();
        assert.equal(s.rows, 4);
        assert.equal(s.cols, 7);
        assert.equal(s.grid.length, 4);
        assert.ok(s.grid.every(row => row.length === 7 && row.every(c => c === true)));
        assert.equal(s.remaining, 28);
        assert.equal(s.lastMove, null);
        assert.equal(s.activePlayerIndex, 1);
        assert.equal(s.isGameOver, false);
    });

    it('removes every square below and to the right (inclusive)', () => {
        const game = newGame(0);
        assert.equal(game.makeMove(0, { row: 2, col: 4 }).valid, true);
        const s = game.getState();
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 7; c++) {
                const expected = !(r >= 2 && c >= 4);
                assert.equal(s.grid[r][c], expected, `cell ${r},${c}`);
            }
        }
        assert.equal(s.remaining, 28 - 6);
        assert.deepEqual(s.lastMove, { row: 2, col: 4, player: 0, removed: 6 });
        assert.equal(s.activePlayerIndex, 1);
    });

    it('counts only squares that were still present in removed', () => {
        const game = newGame(0);
        game.makeMove(0, { row: 2, col: 4 }); // removes 6
        game.makeMove(1, { row: 1, col: 3 }); // rows 1-3 x cols 3-6 = 12, minus the 6 already gone = 6
        assert.equal(game.getState().lastMove.removed, 6);
        assert.equal(game.getState().remaining, 28 - 12);
    });

    it('rejects an already-eaten square', () => {
        const game = newGame(0);
        game.makeMove(0, { row: 1, col: 1 });
        const r = game.makeMove(1, { row: 3, col: 6 });
        assert.equal(r.valid, false);
        assert.match(r.message, /already eaten/);
        assert.equal(game.activePlayerIndex, 1);
    });

    it('rejects moves out of turn and after game over', () => {
        const game = newGame(0);
        assert.equal(game.makeMove(1, { row: 1, col: 1 }).message, 'Not your turn');
        game.makeMove(0, { row: 0, col: 0 });
        assert.equal(game.isGameOver, true);
        assert.equal(game.makeMove(1, { row: 1, col: 1 }).valid, false);
    });

    it('rejects malformed moves without throwing', () => {
        const game = newGame(0);
        const bad = [
            undefined, null, 7, 'x', [], {}, { row: 0 }, { col: 0 }, { row: -1, col: 0 }, { row: 4, col: 0 },
            { row: 0, col: 7 }, { row: 0, col: -1 }, { row: 1.5, col: 1 }, { row: 1, col: 2.2 },
            { row: '1', col: 1 }, { row: 1, col: '1' }, { row: NaN, col: 1 }, { row: null, col: 1 }, { row: true, col: 1 }
        ];
        for (const m of bad) {
            let r;
            assert.doesNotThrow(() => { r = game.makeMove(0, m); });
            assert.equal(r.valid, false, `expected invalid for ${JSON.stringify(m)}`);
            assert.equal(typeof r.message, 'string');
        }
        assert.equal(game.getState().remaining, 28);
        assert.equal(game.activePlayerIndex, 0);
    });

    it('eating the poison loses; the opponent wins', () => {
        const game = newGame(0);
        game.makeMove(0, { row: 1, col: 0 }); // leaves only the top row
        assert.equal(game.getState().remaining, 7);
        game.makeMove(1, { row: 0, col: 1 }); // leaves only the poison
        assert.equal(game.getState().remaining, 1);
        assert.equal(game.isGameOver, false);
        assert.equal(game.makeMove(0, { row: 0, col: 0 }).valid, true);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 1);
        assert.equal(game.getState().remaining, 0);
        assert.deepEqual(game.getState().lastMove, { row: 0, col: 0, player: 0, removed: 1 });
    });

    it('the poison may be taken any time, even on the first move', () => {
        const game = newGame(1);
        assert.equal(game.makeMove(1, { row: 0, col: 0 }).valid, true);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 0);
        assert.equal(game.getState().remaining, 0);
    });

    it('plays a longer legal game with alternating turns to a finish', () => {
        const game = newGame(0);
        const moves = [
            [0, { row: 3, col: 3 }], [1, { row: 2, col: 5 }], [0, { row: 1, col: 6 }], [1, { row: 3, col: 0 }],
            [0, { row: 2, col: 2 }], [1, { row: 1, col: 4 }], [0, { row: 0, col: 5 }], [1, { row: 2, col: 0 }],
            [0, { row: 1, col: 1 }], [1, { row: 0, col: 3 }], [0, { row: 1, col: 0 }], [1, { row: 0, col: 1 }]
        ];
        for (const [p, m] of moves) {
            assert.equal(game.activePlayerIndex, p);
            assert.equal(game.makeMove(p, m).valid, true, JSON.stringify(m));
            assert.equal(game.isGameOver, false);
        }
        assert.equal(game.getState().remaining, 1);
        assert.equal(game.makeMove(0, { row: 0, col: 0 }).valid, true);
        assert.equal(game.winner, 1);
    });

    it('getState returns a copy of the grid', () => {
        const game = newGame(0);
        const s = game.getState();
        s.grid[0][0] = false;
        assert.equal(game.getState().grid[0][0], true);
    });

    it('getStateForPlayer matches the public state (nothing hidden)', () => {
        const game = newGame(0);
        game.makeMove(0, { row: 3, col: 6 });
        assert.deepEqual(game.getStateForPlayer(0), game.getState());
        assert.deepEqual(game.getStateForPlayer(1), game.getState());
    });
});
