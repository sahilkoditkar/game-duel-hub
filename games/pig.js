const BaseGame = require('./base-game');

// Pig: roll to add to your turn total, hold to bank it. A 1 busts the turn. First to 50 (on hold) wins.
class Pig extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.target = 50;
        this.scores = [0, 0];
        this.turnTotal = 0;
        this.lastRoll = null;
        this.lastAction = null; // { player, type: 'roll'|'bust'|'hold', value }
        this.history = [];      // last few actions, newest last
        this.historyLimit = 8;
    }

    rollDie() {
        return 1 + Math.floor(Math.random() * 6);
    }

    pushHistory(entry) {
        this.history.push(entry);
        if (this.history.length > this.historyLimit) this.history.shift();
        this.lastAction = entry;
    }

    makeMove(playerIndex, move) {
        if (this.isGameOver) {
            return { valid: false, message: "Game is over" };
        }
        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: "Not your turn" };
        }
        if (!move || typeof move !== 'object') {
            return { valid: false, message: "Invalid move" };
        }
        const { action } = move;

        if (action === 'roll') {
            const value = this.rollDie();
            if (value === 1) {
                this.turnTotal = 0;
                this.lastRoll = { player: playerIndex, value, busted: true };
                this.pushHistory({ player: playerIndex, type: 'bust', value });
                this.switchTurn();
            } else {
                this.turnTotal += value;
                this.lastRoll = { player: playerIndex, value, busted: false };
                this.pushHistory({ player: playerIndex, type: 'roll', value });
            }
        } else if (action === 'hold') {
            if (this.turnTotal === 0) {
                return { valid: false, message: "Roll at least once before holding" };
            }
            const banked = this.turnTotal;
            this.scores[playerIndex] += banked;
            this.turnTotal = 0;
            this.pushHistory({ player: playerIndex, type: 'hold', value: banked });
            if (this.scores[playerIndex] >= this.target) {
                this.isGameOver = true;
                this.winner = playerIndex;
            } else {
                this.switchTurn();
            }
        } else {
            return { valid: false, message: "Roll or Hold" };
        }

        this.emitState();
        return { valid: true };
    }

    getState() {
        return {
            scores: [...this.scores],
            turnTotal: this.turnTotal,
            lastRoll: this.lastRoll ? { ...this.lastRoll } : null,
            lastAction: this.lastAction ? { ...this.lastAction } : null,
            history: this.history.map(h => ({ ...h })),
            target: this.target,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = Pig;
