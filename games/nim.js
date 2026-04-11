const BaseGame = require('./base-game');

class Nim extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.gameState = {
            rows: [1, 3, 5, 7] // Classic Nim configuration
        };
    }

    makeMove(playerIndex, moveData) {
        const { row, count } = moveData;

        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: "Not your turn" };
        }
        if (this.isGameOver) {
            return { valid: false, message: "Game is over" };
        }
        if (row < 0 || row >= this.gameState.rows.length) {
            return { valid: false, message: "Invalid row" };
        }
        if (count < 1 || count > this.gameState.rows[row]) {
            return { valid: false, message: "Invalid number to remove" };
        }

        this.gameState.rows[row] -= count;

        // Check if all rows are empty (player who took last piece loses)
        if (this.gameState.rows.every(r => r === 0)) {
            this.isGameOver = true;
            this.winner = 1 - playerIndex; // Other player wins
        } else {
            this.switchTurn();
        }

        this.emitState();
        return { valid: true };
    }

    getState() {
        return {
            rows: [...this.gameState.rows],
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = Nim;
