const BaseGame = require('./base-game');

class DotsAndBoxes extends BaseGame {
    constructor(roomId, players, startingPlayerIndex) {
        super(roomId, players, startingPlayerIndex);
        // 4x4 dots = 3x3 boxes
        // Horizontal lines: 4 rows x 3 cols = 12 lines
        // Vertical lines: 3 rows x 4 cols = 12 lines
        // Total lines = 24.
        // We can represent state as checks for these lines.
        // Or simplified: a 3x3 grid of boxes, each knowing its 4 walls.

        this.boardSize = 3; // 3x3 boxes (4x4 dots)
        this.horizontalLines = new Array(4).fill(0).map(() => new Array(3).fill(null)); // [row][col]
        this.verticalLines = new Array(3).fill(0).map(() => new Array(4).fill(null));   // [row][col]
        this.boxes = new Array(3).fill(0).map(() => new Array(3).fill(null));         // [row][col] -> owner playerIndex

        this.scores = [0, 0];
        this.isGameOver = false;
        this.winner = null;
    }

    makeMove(playerIndex, move) {
        // move: { type: 'h' or 'v', row: number, col: number }
        if (this.isGameOver) return { valid: false, message: 'Game is over' };
        if (playerIndex !== this.activePlayerIndex) return { valid: false, message: 'Not your turn' };

        const { type, row, col } = move;

        // Validate coordinates
        if (type === 'h') {
            if (!BaseGame.isIntInRange(row, 0, 3) || !BaseGame.isIntInRange(col, 0, 2)) return { valid: false, message: 'Invalid coordinates' };
            if (this.horizontalLines[row][col] !== null) return { valid: false, message: 'Line already taken' };
            this.horizontalLines[row][col] = playerIndex;
        } else if (type === 'v') {
            if (!BaseGame.isIntInRange(row, 0, 2) || !BaseGame.isIntInRange(col, 0, 3)) return { valid: false, message: 'Invalid coordinates' };
            if (this.verticalLines[row][col] !== null) return { valid: false, message: 'Line already taken' };
            this.verticalLines[row][col] = playerIndex;
        } else {
            return { valid: false, message: 'Invalid move type' };
        }

        // Check if any box was completed
        const boxesCompleted = this.checkBoxes(playerIndex);

        if (boxesCompleted > 0) {
            this.scores[playerIndex] += boxesCompleted;
            // Player keeps turn if they completed a box!
            // activePlayerIndex remains same
        } else {
            this.activePlayerIndex = 1 - this.activePlayerIndex;
        }

        this.checkWin();
        this.emitState();
        return { valid: true };
    }

    checkBoxes(playerIndex) {
        let count = 0;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (this.boxes[r][c] === null) {
                    // Check if all 4 sides are set
                    const top = this.horizontalLines[r][c] !== null;
                    const bottom = this.horizontalLines[r + 1][c] !== null;
                    const left = this.verticalLines[r][c] !== null;
                    const right = this.verticalLines[r][c + 1] !== null;

                    if (top && bottom && left && right) {
                        this.boxes[r][c] = playerIndex;
                        count++;
                    }
                }
            }
        }
        return count;
    }

    checkWin() {
        // Total boxes = 9
        const totalClosed = this.scores[0] + this.scores[1];
        if (totalClosed === 9) {
            this.isGameOver = true;
            if (this.scores[0] > this.scores[1]) this.winner = 0;
            else if (this.scores[1] > this.scores[0]) this.winner = 1;
            else this.winner = 'draw';
        }
    }

    getState() {
        return {
            hLines: this.horizontalLines,
            vLines: this.verticalLines,
            boxes: this.boxes,
            scores: this.scores,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = DotsAndBoxes;
