const BaseGame = require('./base-game');

class Hangman extends BaseGame {
    constructor(roomId, players, startingPlayerIndex, usedWords = []) {
        super(roomId, players, startingPlayerIndex);

        const allWords = [
            'JAVASCRIPT', 'PROGRAMMING', 'COMPUTER', 'INTERNET', 'DATABASE',
            'ALGORITHM', 'NETWORK', 'SECURITY', 'FRONTEND', 'BACKEND',
            'VARIABLE', 'FUNCTION', 'BROWSER', 'KEYBOARD', 'MONITOR',
            'SOFTWARE', 'HARDWARE', 'APPLICATION', 'COMPONENT', 'INTERFACE'
        ];

        // Filter out used words
        let availableWords = allWords.filter(w => !usedWords.includes(w));

        // Reset if all words used
        if (availableWords.length === 0) {
            availableWords = allWords;
        }

        this.word = availableWords[Math.floor(Math.random() * availableWords.length)];
        this.guessedLetters = [];
        this.lives = 6;
        this.scores = [0, 0]; // Points for correct letters
        this.isGameOver = false;
        this.winner = null;
    }

    makeMove(playerIndex, move) {
        // move: { letter: "A" }
        if (this.isGameOver) return { valid: false, message: 'Game is over' };
        if (playerIndex !== this.activePlayerIndex) return { valid: false, message: 'Not your turn' };

        let { letter } = move;
        if (!letter || typeof letter !== 'string' || letter.length !== 1) {
            return { valid: false, message: 'Invalid move' };
        }

        letter = letter.toUpperCase();

        if (this.guessedLetters.includes(letter)) {
            return { valid: false, message: 'Letter already guessed' };
        }

        this.guessedLetters.push(letter);

        let hit = false;
        let count = 0;

        for (let char of this.word) {
            if (char === letter) {
                count++;
            }
        }

        if (count > 0) {
            hit = true;
            this.scores[playerIndex] += count; // 1 point per occurrence
        } else {
            this.lives--;
        }

        this.checkWin();

        // Streak Mechanic:
        // Hit = Play again (activePlayerIndex stays same)
        // Miss = Switch turn
        if (!hit && !this.isGameOver) {
            this.activePlayerIndex = 1 - this.activePlayerIndex;
        }

        this.emitState();
        return { valid: true };
    }

    checkWin() {
        // Check if word is fully solved
        const isSolved = this.word.split('').every(char => this.guessedLetters.includes(char));

        if (isSolved) {
            this.isGameOver = true;
            // High score wins
            if (this.scores[0] > this.scores[1]) {
                this.winner = 0;
            } else if (this.scores[1] > this.scores[0]) {
                this.winner = 1;
            } else {
                this.winner = 'draw';
            }
        } else if (this.lives <= 0) {
            this.isGameOver = true;
            // Lives ran out: Decide by score
            if (this.scores[0] > this.scores[1]) {
                this.winner = 0;
            } else if (this.scores[1] > this.scores[0]) {
                this.winner = 1;
            } else {
                this.winner = 'draw';
            }
        }
    }

    getState() {
        // Mask the word for client
        const maskedWord = this.word.split('').map(char =>
            this.guessedLetters.includes(char) ? char : '_'
        ).join('');

        return {
            ...super.getState(),
            maskedWord: maskedWord,
            guessedLetters: this.guessedLetters,
            lives: this.lives,
            scores: this.scores,
            revealedWord: this.isGameOver ? this.word : null
        };
    }
}

module.exports = Hangman;
