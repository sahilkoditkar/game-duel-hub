const BaseGame = require('./base-game');

const SIZE = 15;
const WIN_LENGTH = 5;

// Gomoku (Five in a Row): 15x15 board, player 0 is black, player 1 is white.
class Gomoku extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.size = SIZE;
        this.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        this.lastMove = null;
        this.moveCount = 0;
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
        const { row, col } = move;
        if (!BaseGame.isIntInRange(row, 0, SIZE - 1) || !BaseGame.isIntInRange(col, 0, SIZE - 1)) {
            return { valid: false, message: 'Invalid square' };
        }
        if (this.board[row][col] !== null) {
            return { valid: false, message: 'Square already taken' };
        }

        this.board[row][col] = playerIndex;
        this.lastMove = { row, col };
        this.moveCount++;

        if (this.checkWin(row, col, playerIndex)) {
            this.isGameOver = true;
            this.winner = playerIndex;
        } else if (this.moveCount >= SIZE * SIZE) {
            this.isGameOver = true;
            this.winner = 'draw';
        } else {
            this.switchTurn();
        }

        this.emitState();
        return { valid: true };
    }

    // Counts stones of `player` through (row, col) in each of the four line directions.
    checkWin(row, col, player) {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (const [dr, dc] of directions) {
            let count = 1;
            for (const sign of [1, -1]) {
                let r = row + dr * sign;
                let c = col + dc * sign;
                while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && this.board[r][c] === player) {
                    count++;
                    r += dr * sign;
                    c += dc * sign;
                }
            }
            if (count >= WIN_LENGTH) return true;
        }
        return false;
    }

    getState() {
        return {
            board: this.board,
            size: SIZE,
            lastMove: this.lastMove,
            moveCount: this.moveCount,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = Gomoku;
