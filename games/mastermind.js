const BaseGame = require('./base-game');

class Mastermind extends BaseGame {
    constructor(roomId, players, startingPlayerIndex, lastMakerIndex = null) {
        super(roomId, players, startingPlayerIndex);

        // Determine Maker/Breaker
        if (lastMakerIndex !== null && lastMakerIndex !== undefined) {
            this.makerIndex = 1 - lastMakerIndex;
        } else {
            this.makerIndex = startingPlayerIndex; // Default start
        }

        this.breakerIndex = 1 - this.makerIndex;
        // Active Player starts as Maker (to set code)
        this.activePlayerIndex = this.makerIndex;

        this.secretCode = []; // [1, 2, 3, 4]
        this.phase = 'SETUP'; // SETUP -> PLAYING
        this.guesses = []; // { code: [], feedback: [] }
        this.maxAttempts = 4;

        this.scores = [0, 0];
        this.isGameOver = false;
        this.winner = null;
    }

    makeMove(playerIndex, move) {
        // move: { code: [0, 1, 2, 3] }
        if (this.isGameOver) return { valid: false, message: 'Game is over' };
        if (playerIndex !== this.activePlayerIndex)
            return { valid: false, message: 'Not your turn' };

        const { code } = move;
        if (!Array.isArray(code) || code.length !== 4) {
            return { valid: false, message: 'Invalid code length' };
        }

        // Validate digits (0-9)
        if (!code.every((d) => Number.isInteger(d) && d >= 0 && d <= 9)) {
            return { valid: false, message: 'Invalid digits (0-9 only)' };
        }

        if (this.phase === 'SETUP') {
            // Maker setting the code
            if (playerIndex !== this.makerIndex)
                return { valid: false, message: 'Only Maker can set code' };

            this.secretCode = code;
            this.phase = 'PLAYING';
            this.activePlayerIndex = this.breakerIndex; // Switch to Breaker
        } else if (this.phase === 'PLAYING') {
            // Breaker guessing
            if (playerIndex !== this.breakerIndex)
                return { valid: false, message: 'Only Breaker can guess' };

            const feedback = this.calculateFeedback(this.secretCode, code);
            // Feedback is now an array: [2, 0, 1, 0]
            // 2 = Correct (Green), 1 = Present (Yellow), 0 = Absent (Grey)

            this.guesses.push({
                code,
                feedback,
            });

            // Check Win: All 2s
            if (feedback.every((f) => f === 2)) {
                this.isGameOver = true;
                this.winner = this.breakerIndex; // Breaker wins
                this.scores[this.winner] = 1;
            } else if (this.guesses.length >= this.maxAttempts) {
                this.isGameOver = true;
                this.winner = this.makerIndex; // Maker wins
                this.scores[this.winner] = 1;
            }
        }

        this.emitState();
        return { valid: true };
    }

    calculateFeedback(secret, guess) {
        // Feedback State: 0 (Absent), 1 (Present), 2 (Correct)
        const feedback = new Array(4).fill(0);
        const secretUsage = new Array(4).fill(false); // Track used secret slots
        const guessUsage = new Array(4).fill(false); // Track used guess slots

        // 1. Pass: Find Correct (Green/2)
        for (let i = 0; i < 4; i++) {
            if (guess[i] === secret[i]) {
                feedback[i] = 2;
                secretUsage[i] = true;
                guessUsage[i] = true;
            }
        }

        // 2. Pass: Find Present (Yellow/1)
        for (let i = 0; i < 4; i++) {
            if (guessUsage[i]) continue; // Already green

            // Look for this digit in secret, somewhere else
            const digit = guess[i];

            for (let j = 0; j < 4; j++) {
                if (!secretUsage[j] && secret[j] === digit) {
                    feedback[i] = 1;
                    secretUsage[j] = true;
                    guessUsage[i] = true;
                    break;
                }
            }
        }

        return feedback;
    }

    getState() {
        const state = super.getState();

        return {
            ...state,
            phase: this.phase,
            makerIndex: this.makerIndex,
            guesses: this.guesses,
            maxAttempts: this.maxAttempts,
            secretCode: this.secretCode, // Send always. Client uses it if Maker.
            // Add a flag to confirm setup is done
            isSetupDone: this.phase === 'PLAYING',
        };
    }
}

module.exports = Mastermind;
