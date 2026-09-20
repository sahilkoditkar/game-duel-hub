const BaseGame = require('./base-game');

class ConnectFour extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        // 6 rows x 7 columns, bottom row = index 5
        this.rows = 6;
        this.cols = 7;
        this.gameState = {
            board: Array.from({ length: this.rows }, () => Array(this.cols).fill(null)),
            symbols: ['R', 'Y'] // Red and Yellow
        };
    }

    makeMove(playerIndex, moveData) {
        const { col } = moveData;

        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: "Not your turn" };
        }
        if (this.isGameOver) {
            return { valid: false, message: "Game is over" };
        }
        if (!BaseGame.isIntInRange(col, 0, this.cols - 1)) {
            return { valid: false, message: "Invalid column" };
        }

        // Find lowest empty row in column
        let row = -1;
        for (let r = this.rows - 1; r >= 0; r--) {
            if (this.gameState.board[r][col] === null) {
                row = r;
                break;
            }
        }

        if (row === -1) {
            return { valid: false, message: "Column is full" };
        }

        const symbol = this.gameState.symbols[playerIndex];
        this.gameState.board[row][col] = symbol;

        if (this.checkWin(row, col, symbol)) {
            this.isGameOver = true;
            this.winner = playerIndex;
        } else if (this.isBoardFull()) {
            this.isGameOver = true;
            this.winner = 'draw';
        } else {
            this.switchTurn();
        }

        this.emitState();
        return { valid: true };
    }

    checkWin(row, col, symbol) {
        const directions = [
            [0, 1],  // horizontal
            [1, 0],  // vertical
            [1, 1],  // diagonal down-right
            [1, -1]  // diagonal down-left
        ];

        for (const [dr, dc] of directions) {
            let count = 1;
            // Check forward
            for (let i = 1; i < 4; i++) {
                const r = row + dr * i;
                const c = col + dc * i;
                if (r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.gameState.board[r][c] === symbol) {
                    count++;
                } else break;
            }
            // Check backward
            for (let i = 1; i < 4; i++) {
                const r = row - dr * i;
                const c = col - dc * i;
                if (r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.gameState.board[r][c] === symbol) {
                    count++;
                } else break;
            }
            if (count >= 4) return true;
        }
        return false;
    }

    isBoardFull() {
        return this.gameState.board[0].every(cell => cell !== null);
    }

    getState() {
        return {
            board: this.gameState.board,
            symbols: this.gameState.symbols,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = ConnectFour;
