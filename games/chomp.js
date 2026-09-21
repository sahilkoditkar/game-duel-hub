const BaseGame = require('./base-game');

// Chomp: a 4x7 chocolate bar whose top-left square is poisoned. A move eats the chosen
// square and everything below and to the right of it. Eating the poison loses.
class Chomp extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.rows = 4;
        this.cols = 7;
        this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(true));
        this.lastMove = null;
    }

    makeMove(playerIndex, move) {
        if (this.isGameOver) {
            return { valid: false, message: "Game is over" };
        }
        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: "Not your turn" };
        }
        if (!move || typeof move !== 'object') {
            return { valid: false, message: "Invalid move" };
        }
        const { row, col } = move;
        if (!BaseGame.isIntInRange(row, 0, this.rows - 1) || !BaseGame.isIntInRange(col, 0, this.cols - 1)) {
            return { valid: false, message: "Pick a square on the bar" };
        }
        if (!this.grid[row][col]) {
            return { valid: false, message: "That square is already eaten" };
        }

        let removed = 0;
        for (let r = row; r < this.rows; r++) {
            for (let c = col; c < this.cols; c++) {
                if (this.grid[r][c]) {
                    this.grid[r][c] = false;
                    removed++;
                }
            }
        }
        this.lastMove = { row, col, player: playerIndex, removed };

        if (row === 0 && col === 0) {
            this.isGameOver = true;
            this.winner = 1 - playerIndex; // ate the poison
        } else {
            this.switchTurn();
        }

        this.emitState();
        return { valid: true };
    }

    remaining() {
        let n = 0;
        for (const row of this.grid) for (const cell of row) if (cell) n++;
        return n;
    }

    getState() {
        return {
            rows: this.rows,
            cols: this.cols,
            grid: this.grid.map(row => [...row]),
            remaining: this.remaining(),
            lastMove: this.lastMove ? { ...this.lastMove } : null,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = Chomp;
