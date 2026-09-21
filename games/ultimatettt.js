const BaseGame = require('./base-game');

const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// Returns 0/1 when that player owns a line, 'draw' when full with no line, else null.
function resolveBoard(cells) {
    for (const [a, b, c] of LINES) {
        if (cells[a] !== null && cells[a] !== 'draw' && cells[a] === cells[b] && cells[a] === cells[c]) {
            return cells[a];
        }
    }
    return cells.every(v => v !== null) ? 'draw' : null;
}

// Ultimate Tic-Tac-Toe: nine 3x3 boards arranged 3x3. Player 0 is X, player 1 is O.
class UltimateTtt extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.boards = Array.from({ length: 9 }, () => Array(9).fill(null));
        this.boardWinners = Array(9).fill(null);
        this.nextBoard = null; // null = any open board
        this.lastMove = null;
    }

    makeMove(playerIndex, move) {
        if (this.isGameOver) {
            return { valid: false, message: 'Game is over' };
        }
        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: 'Not your turn' };
        }
        if (!move || typeof move !== 'object') {
            return { valid: false, message: 'Invalid move' };
        }
        const { board, cell } = move;
        if (!BaseGame.isIntInRange(board, 0, 8) || !BaseGame.isIntInRange(cell, 0, 8)) {
            return { valid: false, message: 'Invalid square' };
        }
        if (this.boardWinners[board] !== null) {
            return { valid: false, message: 'That board is already decided' };
        }
        if (this.nextBoard !== null && board !== this.nextBoard) {
            return { valid: false, message: 'Play in the highlighted board' };
        }
        if (this.boards[board][cell] !== null) {
            return { valid: false, message: 'Square already taken' };
        }

        this.boards[board][cell] = playerIndex;
        this.lastMove = { board, cell };

        const small = resolveBoard(this.boards[board]);
        if (small !== null) this.boardWinners[board] = small;

        const big = resolveBoard(this.boardWinners);
        if (big === 0 || big === 1) {
            this.isGameOver = true;
            this.winner = big;
            this.nextBoard = null;
        } else if (big === 'draw') {
            this.isGameOver = true;
            this.winner = 'draw';
            this.nextBoard = null;
        } else {
            this.nextBoard = this.boardWinners[cell] === null ? cell : null;
            this.switchTurn();
        }

        this.emitState();
        return { valid: true };
    }

    getState() {
        return {
            boards: this.boards,
            boardWinners: this.boardWinners,
            nextBoard: this.nextBoard,
            lastMove: this.lastMove,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = UltimateTtt;
