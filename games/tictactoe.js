const BaseGame = require('./base-game');

class TicTacToe extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        // Board is 3x3 grid, represented by array of 9 nulls
        this.gameState = {
            board: Array(9).fill(null),
            symbols: ['X', 'O'] // player 0 gets X, player 1 gets O
        };
    }

    makeMove(playerIndex, moveData) {
        const { index } = moveData;

        // Validation
        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: "Not your turn" };
        }
        if (this.isGameOver) {
            return { valid: false, message: "Game is over" };
        }
        if (this.gameState.board[index] !== null) {
            return { valid: false, message: "Invalid move" };
        }

        // Execute move
        const symbol = this.gameState.symbols[playerIndex];
        this.gameState.board[index] = symbol;

        // Check win
        if (this.checkWin(symbol)) {
            this.isGameOver = true;
            this.winner = playerIndex;
        } else if (this.gameState.board.every(cell => cell !== null)) {
            this.isGameOver = true;
            this.winner = 'draw';
        } else {
            this.switchTurn();
        }

        this.emitState();
        return { valid: true };
    }

    checkWin(symbol) {
        const wins = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
            [0, 4, 8], [2, 4, 6]           // Diagonals
        ];

        return wins.some(combo => {
            return combo.every(i => this.gameState.board[i] === symbol);
        });
    }
}

module.exports = TicTacToe;
