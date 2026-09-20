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
        const used = Array.isArray(usedWords) ? usedWords : [];
        let availableWords = allWords.filter(w => !used.includes(w));

        // Reset if all words used
        if (availableWords.length === 0) {
            availableWords = allWords;
        }

        this.word = availableWords[Math.floor(Math.random() * availableWords.length)];
        this.guessedLetters = [];
        // Each player has their own lives pool now (was shared)
        this.maxLives = 6;
        this.lives = [this.maxLives, this.maxLives];
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
        if (!/^[A-Z]$/.test(letter)) {
            return { valid: false, message: 'Guess a letter A-Z' };
        }

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
            // Only the guessing player loses a life
            this.lives[playerIndex]--;
        }

        this.checkWin();

        // Streak Mechanic:
        // Hit = Play again (activePlayerIndex stays same)
        // Miss = Switch turn (unless other player is also out of lives)
        if (!hit && !this.isGameOver) {
            const otherPlayer = 1 - this.activePlayerIndex;
            // Only switch if other player still has lives
            if (this.lives[otherPlayer] > 0) {
                this.activePlayerIndex = otherPlayer;
            }
            // If both run out, checkWin will end the game
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
            return;
        }

        // If a player runs out of lives, they're eliminated
        const p0Out = this.lives[0] <= 0;
        const p1Out = this.lives[1] <= 0;

        if (p0Out && p1Out) {
            // Both eliminated - decide by score
            this.isGameOver = true;
            if (this.scores[0] > this.scores[1]) this.winner = 0;
            else if (this.scores[1] > this.scores[0]) this.winner = 1;
            else this.winner = 'draw';
        } else if (p0Out) {
            // Player 0 eliminated, player 1 wins
            this.isGameOver = true;
            this.winner = 1;
        } else if (p1Out) {
            // Player 1 eliminated, player 0 wins
            this.isGameOver = true;
            this.winner = 0;
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
