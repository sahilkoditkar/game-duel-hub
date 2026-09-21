const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const UltimateTtt = require('../games/ultimatettt');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

function newGame(starter = 0) {
    return new UltimateTtt('r', [fakeSocket('a'), fakeSocket('b')], starter);
}

function play(game, player, board, cell) {
    const result = game.makeMove(player, { board, cell });
    assert.equal(result.valid, true, `move p${player} b${board} c${cell}: ${result.message}`);
    return result;
}

// X (player 0) wins boards 0, 1 and 2. O (player 1) is sent to boards 3-8 and
// always answers with a top-row cell that sends X back to the board X needs.
function playXWinsTopRow(game) {
    play(game, 0, 0, 6); // -> 6
    play(game, 1, 6, 0); // -> 0
    play(game, 0, 0, 7); // -> 7
    play(game, 1, 7, 0); // -> 0
    play(game, 0, 0, 8); // X wins board 0, -> 8
    assert.equal(game.boardWinners[0], 0);
    play(game, 1, 8, 1); // -> 1
    play(game, 0, 1, 3); // -> 3
    play(game, 1, 3, 1); // -> 1
    play(game, 0, 1, 4); // -> 4
    play(game, 1, 4, 1); // -> 1
    play(game, 0, 1, 5); // X wins board 1, -> 5
    assert.equal(game.boardWinners[1], 0);
    play(game, 1, 5, 2); // -> 2
    play(game, 0, 2, 6); // -> 6
    play(game, 1, 6, 2); // -> 2
    play(game, 0, 2, 7); // -> 7
    play(game, 1, 7, 2); // -> 2
    play(game, 0, 2, 8); // X wins board 2 and the game
}

describe('Ultimate Tic-Tac-Toe setup', () => {
    it('starts with nine empty boards and free choice of board', () => {
        const game = newGame();
        const s = game.getState();
        assert.equal(s.boards.length, 9);
        assert.ok(s.boards.every(b => b.length === 9 && b.every(c => c === null)));
        assert.deepEqual(s.boardWinners, Array(9).fill(null));
        assert.equal(s.nextBoard, null);
        assert.equal(s.lastMove, null);
        assert.equal(s.activePlayerIndex, 0);
        assert.equal(s.isGameOver, false);
        assert.equal(s.winner, null);
    });

    it('honors the starting player', () => {
        const game = newGame(1);
        assert.equal(game.makeMove(0, { board: 4, cell: 4 }).valid, false);
        assert.equal(game.makeMove(1, { board: 4, cell: 4 }).valid, true);
        assert.equal(game.boards[4][4], 1);
    });

    it('getStateForPlayer matches public state (nothing hidden)', () => {
        const game = newGame();
        play(game, 0, 4, 4);
        assert.deepEqual(game.getStateForPlayer(0), game.getState());
        assert.deepEqual(game.getStateForPlayer(1), game.getState());
    });
});

describe('Ultimate Tic-Tac-Toe routing rule', () => {
    it('sends the opponent to the board matching the cell just played', () => {
        const game = newGame();
        play(game, 0, 4, 7);
        assert.equal(game.nextBoard, 7);
        assert.deepEqual(game.lastMove, { board: 4, cell: 7 });
        assert.equal(game.activePlayerIndex, 1);
    });

    it('rejects a move outside the required board', () => {
        const game = newGame();
        play(game, 0, 4, 7);
        const result = game.makeMove(1, { board: 3, cell: 0 });
        assert.equal(result.valid, false);
        assert.equal(game.boards[3][0], null);
        assert.equal(game.activePlayerIndex, 1);
        play(game, 1, 7, 0);
        assert.equal(game.nextBoard, 0);
    });

    it('frees the opponent (nextBoard null) when the target board is already won', () => {
        const game = newGame();
        play(game, 0, 0, 6);
        play(game, 1, 6, 0);
        play(game, 0, 0, 7);
        play(game, 1, 7, 0);
        play(game, 0, 0, 8); // board 0 won by X
        assert.equal(game.boardWinners[0], 0);
        play(game, 1, 8, 0); // cell 0 points at a decided board
        assert.equal(game.nextBoard, null);
        // X may now play anywhere open...
        play(game, 0, 4, 4);
        // ...but never inside a decided board
        game.activePlayerIndex = 0;
        game.nextBoard = null;
        assert.equal(game.makeMove(0, { board: 0, cell: 1 }).valid, false);
    });

    it('rejects a taken cell and keeps the turn', () => {
        const game = newGame();
        play(game, 0, 4, 4);
        const result = game.makeMove(1, { board: 4, cell: 4 });
        assert.equal(result.valid, false);
        assert.equal(game.activePlayerIndex, 1);
    });
});

describe('Ultimate Tic-Tac-Toe small boards', () => {
    it('marks a full small board with no line as draw and frees the next choice', () => {
        const game = newGame();
        // X O X / X O O / O X _   (X = 0, O = 1), no line, cell 8 open
        game.boards[0] = [0, 1, 0, 0, 1, 1, 1, 0, null];
        game.nextBoard = 0;
        game.activePlayerIndex = 0;
        play(game, 0, 0, 8);
        assert.equal(game.boardWinners[0], 'draw');
        // cell 8 points at board 8, which is open
        assert.equal(game.nextBoard, 8);
        game.activePlayerIndex = 1;
        game.nextBoard = null;
        assert.equal(game.makeMove(1, { board: 0, cell: 8 }).valid, false);
    });

    it('a drawn small board does not count as a line for either player', () => {
        const game = newGame();
        game.boardWinners = [0, 'draw', 0, null, null, null, null, null, null];
        game.boards[1] = [0, 1, 0, 0, 1, 1, 1, 0, 0];
        game.nextBoard = null;
        game.activePlayerIndex = 0;
        play(game, 0, 4, 4);
        assert.equal(game.isGameOver, false);
    });

    it('sends the opponent to a drawn board as a free move', () => {
        const game = newGame();
        game.boardWinners[3] = 'draw';
        game.boards[3] = [0, 1, 0, 0, 1, 1, 1, 0, 0];
        play(game, 0, 4, 3);
        assert.equal(game.nextBoard, null);
    });
});

describe('Ultimate Tic-Tac-Toe game end', () => {
    it('plays a full legal game that X wins by owning the top row of boards', () => {
        const game = newGame();
        playXWinsTopRow(game);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 0);
        assert.deepEqual(game.boardWinners.slice(0, 3), [0, 0, 0]);
        assert.equal(game.nextBoard, null);
        assert.deepEqual(game.lastMove, { board: 2, cell: 8 });
        assert.equal(game.makeMove(1, { board: 5, cell: 0 }).valid, false);
    });

    it('O can win with a diagonal of boards', () => {
        const game = newGame();
        game.boardWinners = [1, null, null, null, 1, null, null, null, null];
        game.boards[0] = [1, 1, 1, null, null, null, null, null, null];
        game.boards[4] = [1, 1, 1, null, null, null, null, null, null];
        game.boards[8] = [1, 1, null, 0, 0, null, null, null, null];
        game.activePlayerIndex = 1;
        game.nextBoard = 8;
        play(game, 1, 8, 2);
        assert.equal(game.boardWinners[8], 1);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 1);
    });

    it('declares a draw when all boards are decided without a big line', () => {
        const game = newGame();
        // X O X / X O O / O X ?  -> board 8 about to be won by X, no big line results
        game.boardWinners = [0, 1, 0, 0, 1, 1, 1, 0, null];
        for (let b = 0; b < 8; b++) {
            const w = game.boardWinners[b];
            game.boards[b] = [w, w, w, null, null, null, null, null, null];
        }
        game.boards[8] = [0, 0, null, 1, 1, null, null, null, null];
        game.activePlayerIndex = 0;
        game.nextBoard = 8;
        play(game, 0, 8, 2);
        assert.equal(game.boardWinners[8], 0);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 'draw');
    });

    it('a small-board draw can be the final decider of a big draw', () => {
        const game = newGame();
        game.boardWinners = [0, 1, 0, 0, 1, 1, 1, 0, null];
        for (let b = 0; b < 8; b++) {
            const w = game.boardWinners[b];
            game.boards[b] = [w, w, w, null, null, null, null, null, null];
        }
        game.boards[8] = [0, 1, 0, 0, 1, 1, 1, 0, null];
        game.activePlayerIndex = 0;
        game.nextBoard = 8;
        play(game, 0, 8, 8);
        assert.equal(game.boardWinners[8], 'draw');
        assert.equal(game.winner, 'draw');
    });
});

describe('Ultimate Tic-Tac-Toe rejects bad moves without throwing', () => {
    const bad = [
        undefined, null, 'nope', 7, [],
        {}, { board: 0 }, { cell: 0 },
        { board: 0.5, cell: 0 }, { board: 0, cell: 4.4 },
        { board: '0', cell: 0 }, { board: 0, cell: '0' },
        { board: -1, cell: 0 }, { board: 9, cell: 0 }, { board: 0, cell: -1 }, { board: 0, cell: 9 },
        { board: NaN, cell: 0 }
    ];
    for (const move of bad) {
        it(`rejects ${JSON.stringify(move)}`, () => {
            const game = newGame();
            let result;
            assert.doesNotThrow(() => { result = game.makeMove(0, move); });
            assert.equal(result.valid, false);
            assert.equal(typeof result.message, 'string');
            assert.ok(game.boards.every(b => b.every(c => c === null)));
            assert.equal(game.activePlayerIndex, 0);
        });
    }

    it('rejects a move by the wrong player', () => {
        const game = newGame();
        const result = game.makeMove(1, { board: 4, cell: 4 });
        assert.equal(result.valid, false);
        assert.equal(result.message, 'Not your turn');
    });

    it('rejects moves after the game is over', () => {
        const game = newGame();
        playXWinsTopRow(game);
        assert.equal(game.makeMove(1, { board: 3, cell: 0 }).valid, false);
        assert.equal(game.makeMove(0, { board: 3, cell: 0 }).valid, false);
    });
});
