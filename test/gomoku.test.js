const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Gomoku = require('../games/gomoku');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

function newGame(starter = 0) {
    return new Gomoku('r', [fakeSocket('a'), fakeSocket('b')], starter);
}

// Plays alternating moves: player 0 along `line0`, player 1 along `line1`.
function playLines(game, line0, line1) {
    for (let i = 0; i < line0.length; i++) {
        assert.equal(game.makeMove(0, line0[i]).valid, true, `p0 move ${i}`);
        if (game.isGameOver) return;
        if (i < line1.length) {
            assert.equal(game.makeMove(1, line1[i]).valid, true, `p1 move ${i}`);
        }
    }
}

describe('Gomoku setup', () => {
    it('starts with an empty 15x15 board and no last move', () => {
        const game = newGame();
        const state = game.getState();
        assert.equal(state.board.length, 15);
        assert.ok(state.board.every(row => row.length === 15 && row.every(c => c === null)));
        assert.equal(state.lastMove, null);
        assert.equal(state.activePlayerIndex, 0);
        assert.equal(state.isGameOver, false);
        assert.equal(state.winner, null);
    });

    it('honors the starting player', () => {
        const game = newGame(1);
        assert.equal(game.makeMove(0, { row: 7, col: 7 }).valid, false);
        assert.equal(game.makeMove(1, { row: 7, col: 7 }).valid, true);
        assert.equal(game.board[7][7], 1);
        assert.equal(game.activePlayerIndex, 0);
    });

    it('getStateForPlayer matches public state (nothing hidden)', () => {
        const game = newGame();
        game.makeMove(0, { row: 3, col: 4 });
        assert.deepEqual(game.getStateForPlayer(0), game.getState());
        assert.deepEqual(game.getStateForPlayer(1), game.getState());
        assert.deepEqual(game.getStateForPlayer(1).lastMove, { row: 3, col: 4 });
    });
});

describe('Gomoku wins', () => {
    it('detects a horizontal five', () => {
        const game = newGame();
        const p0 = [0, 1, 2, 3, 4].map(c => ({ row: 7, col: c }));
        const p1 = [0, 1, 2, 3].map(c => ({ row: 8, col: c }));
        playLines(game, p0, p1);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 0);
        assert.deepEqual(game.lastMove, { row: 7, col: 4 });
    });

    it('detects a vertical five for player 1', () => {
        const game = newGame();
        const p0 = [0, 1, 2, 3, 4].map(r => ({ row: r, col: 0 }));
        const p1 = [0, 1, 2, 3, 4].map(r => ({ row: r, col: 14 }));
        // p0 plays a scattered fifth move so p1 completes first
        p0[4] = { row: 10, col: 10 };
        playLines(game, p0, p1);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 1);
    });

    it('detects a diagonal five', () => {
        const game = newGame();
        const p0 = [0, 1, 2, 3, 4].map(i => ({ row: i, col: i }));
        const p1 = [0, 1, 2, 3].map(i => ({ row: 14, col: i }));
        playLines(game, p0, p1);
        assert.equal(game.winner, 0);
    });

    it('detects an anti-diagonal five', () => {
        const game = newGame();
        const p0 = [0, 1, 2, 3, 4].map(i => ({ row: i, col: 14 - i }));
        const p1 = [0, 1, 2, 3].map(i => ({ row: 14, col: i }));
        playLines(game, p0, p1);
        assert.equal(game.winner, 0);
    });

    it('counts a win when the fifth stone fills a gap in the middle', () => {
        const game = newGame();
        const p0 = [0, 1, 3, 4, 2].map(c => ({ row: 5, col: c }));
        const p1 = [0, 1, 2, 3].map(c => ({ row: 6, col: c }));
        playLines(game, p0, p1);
        assert.equal(game.winner, 0);
        assert.deepEqual(game.lastMove, { row: 5, col: 2 });
    });

    it('treats six in a row (overline) as a win', () => {
        const game = newGame();
        const p0 = [0, 1, 2, 4, 5, 3].map(c => ({ row: 5, col: c }));
        const p1 = [0, 1, 2, 3, 4].map(c => ({ row: 9, col: c }));
        p1[4] = { row: 12, col: 12 }; // keep p1 from winning first
        playLines(game, p0, p1);
        assert.equal(game.winner, 0);
    });

    it('does not count four in a row as a win', () => {
        const game = newGame();
        const p0 = [0, 1, 2, 3].map(c => ({ row: 7, col: c }));
        const p1 = [0, 1, 2, 3].map(c => ({ row: 8, col: c }));
        playLines(game, p0, p1);
        assert.equal(game.isGameOver, false);
        assert.equal(game.winner, null);
    });

    it('does not count five that wrap around a row edge', () => {
        const game = newGame();
        // p0 stones at (0,12),(0,13),(0,14),(1,0),(1,1): adjacent in memory order but not on the board
        const p0 = [{ row: 0, col: 12 }, { row: 0, col: 13 }, { row: 0, col: 14 }, { row: 1, col: 0 }, { row: 1, col: 1 }];
        const p1 = [0, 1, 2, 3].map(c => ({ row: 10, col: c }));
        playLines(game, p0, p1);
        assert.equal(game.isGameOver, false);
    });

    it('rejects moves after the game is over', () => {
        const game = newGame();
        const p0 = [0, 1, 2, 3, 4].map(c => ({ row: 7, col: c }));
        const p1 = [0, 1, 2, 3].map(c => ({ row: 8, col: c }));
        playLines(game, p0, p1);
        assert.equal(game.isGameOver, true);
        const result = game.makeMove(1, { row: 8, col: 4 });
        assert.equal(result.valid, false);
        assert.equal(game.board[8][4], null);
    });
});

describe('Gomoku draw', () => {
    it('declares a draw when the board fills with no five in a row', () => {
        const game = newGame();
        // Pattern with runs of at most 2 in every direction.
        const pattern = (r, c) => (r + Math.floor(c / 2)) % 2;
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                if (r === 14 && c === 14) continue;
                game.board[r][c] = pattern(r, c);
            }
        }
        game.moveCount = 15 * 15 - 1;
        game.activePlayerIndex = pattern(14, 14);
        const result = game.makeMove(game.activePlayerIndex, { row: 14, col: 14 });
        assert.equal(result.valid, true);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 'draw');
    });
});

describe('Gomoku rejects bad moves without throwing', () => {
    const bad = [
        undefined, null, 'nope', 42, [],
        {}, { row: 1 }, { col: 1 },
        { row: 1.5, col: 1 }, { row: 1, col: 2.2 },
        { row: '1', col: 1 }, { row: 1, col: '1' },
        { row: -1, col: 0 }, { row: 0, col: -1 }, { row: 15, col: 0 }, { row: 0, col: 15 },
        { row: NaN, col: 0 }, { row: Infinity, col: 0 }
    ];
    for (const move of bad) {
        it(`rejects ${JSON.stringify(move)}`, () => {
            const game = newGame();
            let result;
            assert.doesNotThrow(() => { result = game.makeMove(0, move); });
            assert.equal(result.valid, false);
            assert.equal(typeof result.message, 'string');
            assert.equal(game.moveCount, 0);
            assert.equal(game.activePlayerIndex, 0);
        });
    }

    it('rejects a move by the wrong player', () => {
        const game = newGame();
        const result = game.makeMove(1, { row: 7, col: 7 });
        assert.equal(result.valid, false);
        assert.equal(result.message, 'Not your turn');
        assert.equal(game.board[7][7], null);
    });

    it('rejects an occupied square and keeps the turn', () => {
        const game = newGame();
        game.makeMove(0, { row: 7, col: 7 });
        const result = game.makeMove(1, { row: 7, col: 7 });
        assert.equal(result.valid, false);
        assert.equal(game.activePlayerIndex, 1);
        assert.equal(game.board[7][7], 0);
    });

    it('rejects an out-of-range player index', () => {
        const game = newGame();
        assert.equal(game.makeMove(2, { row: 0, col: 0 }).valid, false);
        assert.equal(game.makeMove(undefined, { row: 0, col: 0 }).valid, false);
    });
});
