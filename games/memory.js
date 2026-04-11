const BaseGame = require('./base-game');

class Memory extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);

        const symbols = ['\u2660', '\u2665', '\u2666', '\u2663', '\u2605', '\u263A', '\u266B', '\u2744']; // 8 pairs
        const pairs = [...symbols, ...symbols];

        // Shuffle
        for (let i = pairs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
        }

        this.gameState = {
            cards: pairs,           // 16 cards (4x4)
            revealed: Array(16).fill(false),  // permanently revealed (matched)
            flipped: [],            // currently flipped indices (0-2)
            scores: [0, 0],         // pairs found per player
            totalPairs: 8
        };

        this.flipTimeout = null;
    }

    makeMove(playerIndex, moveData) {
        const { index } = moveData;

        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: "Not your turn" };
        }
        if (this.isGameOver) {
            return { valid: false, message: "Game is over" };
        }
        if (index < 0 || index >= 16) {
            return { valid: false, message: "Invalid card" };
        }
        if (this.gameState.revealed[index]) {
            return { valid: false, message: "Card already matched" };
        }
        if (this.gameState.flipped.includes(index)) {
            return { valid: false, message: "Card already flipped" };
        }
        if (this.gameState.flipped.length >= 2) {
            return { valid: false, message: "Wait for cards to flip back" };
        }

        this.gameState.flipped.push(index);

        if (this.gameState.flipped.length === 2) {
            const [first, second] = this.gameState.flipped;
            const isMatch = this.gameState.cards[first] === this.gameState.cards[second];

            if (isMatch) {
                this.gameState.revealed[first] = true;
                this.gameState.revealed[second] = true;
                this.gameState.scores[playerIndex]++;
                this.gameState.flipped = [];

                // Check game over
                if (this.gameState.scores[0] + this.gameState.scores[1] === this.gameState.totalPairs) {
                    this.isGameOver = true;
                    if (this.gameState.scores[0] > this.gameState.scores[1]) {
                        this.winner = 0;
                    } else if (this.gameState.scores[1] > this.gameState.scores[0]) {
                        this.winner = 1;
                    } else {
                        this.winner = 'draw';
                    }
                }
                // Keep turn on match
                this.emitState();
            } else {
                // Show both cards briefly then flip back
                this.emitState();

                // After delay, flip back and switch turn
                this.flipTimeout = setTimeout(() => {
                    this.gameState.flipped = [];
                    this.switchTurn();
                    this.emitState();
                }, 1200);
            }
        } else {
            this.emitState();
        }

        return { valid: true };
    }

    getState() {
        // Only reveal card values for flipped or matched cards
        const visibleCards = this.gameState.cards.map((card, i) => {
            if (this.gameState.revealed[i] || this.gameState.flipped.includes(i)) {
                return card;
            }
            return null;
        });

        return {
            cards: visibleCards,
            revealed: this.gameState.revealed,
            flipped: this.gameState.flipped,
            scores: this.gameState.scores,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }

    cleanup() {
        if (this.flipTimeout) {
            clearTimeout(this.flipTimeout);
        }
    }
}

module.exports = Memory;
