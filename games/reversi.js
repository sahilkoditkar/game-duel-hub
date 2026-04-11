const BaseGame = require('./base-game');

class Reversi extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        // 8x8 board: null = empty, 0 = player 0 (black), 1 = player 1 (white)
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        // Standard starting position
        board[3][3] = 1;
        board[3][4] = 0;
        board[4][3] = 0;
        board[4][4] = 1;

        this.gameState = { board };
    }

    makeMove(playerIndex, moveData) {
        const { row, col } = moveData;

        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: "Not your turn" };
        }
        if (this.isGameOver) {
            return { valid: false, message: "Game is over" };
        }

        const flips = this.getFlips(row, col, playerIndex);
        if (flips.length === 0) {
            return { valid: false, message: "Invalid move - no pieces to flip" };
        }

        // Place piece and flip
        this.gameState.board[row][col] = playerIndex;
        for (const [fr, fc] of flips) {
            this.gameState.board[fr][fc] = playerIndex;
        }

        // Check if opponent can move
        const oppMoves = this.getValidMoves(1 - playerIndex);
        if (oppMoves.length > 0) {
            this.switchTurn();
        } else {
            // Opponent can't move, check if current player can still move
            const myMoves = this.getValidMoves(playerIndex);
            if (myMoves.length === 0) {
                // Neither can move - game over
                this.endGame();
            }
            // Otherwise current player keeps turn
        }

        this.emitState();
        return { valid: true };
    }

    getFlips(row, col, player) {
        if (row < 0 || row >= 8 || col < 0 || col >= 8) return [];
        if (this.gameState.board[row][col] !== null) return [];

        const directions = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        const allFlips = [];

        for (const [dr, dc] of directions) {
            const flips = [];
            let r = row + dr;
            let c = col + dc;

            while (r >= 0 && r < 8 && c >= 0 && c < 8 && this.gameState.board[r][c] === (1 - player)) {
                flips.push([r, c]);
                r += dr;
                c += dc;
            }

            if (flips.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && this.gameState.board[r][c] === player) {
                allFlips.push(...flips);
            }
        }

        return allFlips;
    }

    getValidMoves(player) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.getFlips(r, c, player).length > 0) {
                    moves.push([r, c]);
                }
            }
        }
        return moves;
    }

    endGame() {
        this.isGameOver = true;
        let count0 = 0, count1 = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.gameState.board[r][c] === 0) count0++;
                else if (this.gameState.board[r][c] === 1) count1++;
            }
        }
        if (count0 > count1) this.winner = 0;
        else if (count1 > count0) this.winner = 1;
        else this.winner = 'draw';

        this.gameState.finalScores = [count0, count1];
    }

    getState() {
        const validMoves = this.isGameOver ? [] : this.getValidMoves(this.activePlayerIndex);
        return {
            board: this.gameState.board.map(row => [...row]),
            validMoves,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner,
            finalScores: this.gameState.finalScores || null
        };
    }
}

module.exports = Reversi;
