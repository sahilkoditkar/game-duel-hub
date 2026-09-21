const BaseGame = require('./base-game');
const { WORDS } = require('./wordchain');

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const FIVE_LETTER_WORDS = [...WORDS].filter(w => w.length === WORD_LENGTH);

// Wordle-style per-position feedback: 2 = right spot, 1 = in the word elsewhere, 0 = absent.
// Same two-pass algorithm as Mastermind.calculateFeedback so duplicate letters are handled
// correctly (each secret letter can only be "claimed" once).
function calculateFeedback(secret, guess) {
    const n = secret.length;
    const feedback = new Array(n).fill(0);
    const secretUsed = new Array(n).fill(false);
    const guessUsed = new Array(n).fill(false);

    for (let i = 0; i < n; i++) {
        if (guess[i] === secret[i]) {
            feedback[i] = 2;
            secretUsed[i] = true;
            guessUsed[i] = true;
        }
    }

    for (let i = 0; i < n; i++) {
        if (guessUsed[i]) continue;
        for (let j = 0; j < n; j++) {
            if (!secretUsed[j] && secret[j] === guess[i]) {
                feedback[i] = 1;
                secretUsed[j] = true;
                guessUsed[i] = true;
                break;
            }
        }
    }

    return feedback;
}

class Wordle extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.secret = FIVE_LETTER_WORDS[Math.floor(Math.random() * FIVE_LETTER_WORDS.length)];
        this.maxGuesses = MAX_GUESSES;
        this.guesses = [[], []]; // per player: { word, feedback }
        this.solved = [false, false];
        this.out = [false, false]; // used all guesses without solving
        this.activePlayerIndex = null; // simultaneous race
        this.gameState = { guesses: this.guesses, solved: this.solved };
    }

    makeMove(playerIndex, move) {
        if (this.isGameOver) {
            return { valid: false, message: 'Game is over' };
        }
        if (playerIndex !== 0 && playerIndex !== 1) {
            return { valid: false, message: 'Unknown player' };
        }

        const raw = move && move.word;
        if (typeof raw !== 'string') {
            return { valid: false, message: 'Type a word' };
        }
        const word = raw.trim().toLowerCase();
        if (!/^[a-z]{5}$/.test(word)) {
            return { valid: false, message: 'Word must be 5 letters' };
        }
        if (!WORDS.has(word)) {
            return { valid: false, message: 'Not in word list' };
        }
        if (this.solved[playerIndex]) {
            return { valid: false, message: 'You already solved it' };
        }
        if (this.out[playerIndex] || this.guesses[playerIndex].length >= this.maxGuesses) {
            return { valid: false, message: 'No guesses left' };
        }

        const feedback = calculateFeedback(this.secret, word);
        this.guesses[playerIndex].push({ word, feedback });

        if (word === this.secret) {
            this.solved[playerIndex] = true;
            this.isGameOver = true;
            this.winner = playerIndex;
        } else if (this.guesses[playerIndex].length >= this.maxGuesses) {
            this.out[playerIndex] = true;
            if (this.out[0] && this.out[1]) {
                this.isGameOver = true;
                this.winner = 'draw';
            }
        }

        this.emitState();
        return { valid: true };
    }

    // Public view: never includes the secret before the game ends and never includes letters.
    getState() {
        return {
            guessCounts: [this.guesses[0].length, this.guesses[1].length],
            feedback: [
                this.guesses[0].map(g => g.feedback),
                this.guesses[1].map(g => g.feedback)
            ],
            maxGuesses: this.maxGuesses,
            solved: this.solved.slice(),
            out: this.out.slice(),
            secret: this.isGameOver ? this.secret : null,
            activePlayerIndex: null,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }

    getStateForPlayer(playerIndex) {
        const opp = 1 - playerIndex;
        return {
            myGuesses: this.guesses[playerIndex].map(g => ({ word: g.word, feedback: g.feedback.slice() })),
            opponentFeedback: this.guesses[opp].map(g => g.feedback.slice()), // colors only, no letters
            myGuessCount: this.guesses[playerIndex].length,
            oppGuessCount: this.guesses[opp].length,
            maxGuesses: this.maxGuesses,
            solved: this.solved.slice(),
            out: this.out.slice(),
            secret: this.isGameOver ? this.secret : null,
            activePlayerIndex: null,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = Wordle;
module.exports.calculateFeedback = calculateFeedback;
module.exports.FIVE_LETTER_WORDS = FIVE_LETTER_WORDS;
