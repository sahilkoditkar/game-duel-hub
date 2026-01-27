const BaseGame = require('./base-game');

class Bingo extends BaseGame {
    constructor(roomId, players) {
        super(roomId, players);
        this.size = 5;
        this.maxNumber = 25; // 1-25

        // Generate random board for each player
        this.boards = [
            this.generateBoard(),
            this.generateBoard()
        ];

        this.selectedNumbers = new Set();
        this.activePlayerIndex = 0;
        this.isGameOver = false;
        this.winner = null;

        // Scores in Bingo = Number of lines completed
        this.scores = [0, 0];
        // Target is 5 lines for BINGO
        this.targetLines = 5;
    }

    generateBoard() {
        const nums = Array.from({ length: 25 }, (_, i) => i + 1);
        for (let i = nums.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [nums[i], nums[j]] = [nums[j], nums[i]];
        }

        // Convert to 5x5 grid
        const board = [];
        for (let i = 0; i < 5; i++) {
            board.push(nums.slice(i * 5, (i + 1) * 5));
        }
        return board;
    }

    makeMove(playerIndex, move) {
        // move: { number: integer }
        if (this.isGameOver) return { valid: false, message: 'Game is over' };
        if (playerIndex !== this.activePlayerIndex) return { valid: false, message: 'Not your turn' };

        const { number } = move;
        if (!number || number < 1 || number > 25) return { valid: false, message: 'Invalid number' };
        if (this.selectedNumbers.has(number)) return { valid: false, message: 'Number already selected' };

        this.selectedNumbers.add(number);

        // Update scores (lines completed)
        this.scores[0] = this.countLines(this.boards[0]);
        this.scores[1] = this.countLines(this.boards[1]);

        this.checkWin();

        if (!this.isGameOver) {
            this.activePlayerIndex = 1 - this.activePlayerIndex;
        }

        this.emitState();
        return { valid: true };
    }

    countLines(board) {
        let lines = 0;

        // Rows
        for (let r = 0; r < 5; r++) {
            if (board[r].every(n => this.selectedNumbers.has(n))) lines++;
        }

        // Cols
        for (let c = 0; c < 5; c++) {
            let full = true;
            for (let r = 0; r < 5; r++) {
                if (!this.selectedNumbers.has(board[r][c])) {
                    full = false;
                    break;
                }
            }
            if (full) lines++;
        }

        // Diagonals
        let d1 = true;
        for (let i = 0; i < 5; i++) {
            if (!this.selectedNumbers.has(board[i][i])) {
                d1 = false;
                break;
            }
        }
        if (d1) lines++;

        let d2 = true;
        for (let i = 0; i < 5; i++) {
            if (!this.selectedNumbers.has(board[i][4 - i])) {
                d2 = false;
                break;
            }
        }
        if (d2) lines++;

        return lines;
    }

    checkWin() {
        if (this.scores[0] >= this.targetLines && this.scores[1] >= this.targetLines) {
            this.isGameOver = true;
            this.winner = 'draw';
        } else if (this.scores[0] >= this.targetLines) {
            this.isGameOver = true;
            this.winner = 0;
        } else if (this.scores[1] >= this.targetLines) {
            this.isGameOver = true;
            this.winner = 1;
        }
    }

    getState() {
        return {
            boards: this.boards, // Clients see both? Or just own? For simplicity sending both but logic should hide opponent board if needed. For this friendly game, seeing both is fine or we can filter in getPlayerState if we implemented that. I'll send both for now so we can see opponent progress.
            selectedNumbers: Array.from(this.selectedNumbers),
            scores: this.scores,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = Bingo;
