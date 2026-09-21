const BaseGame = require('./base-game');

const LADDERS = { 3: 22, 5: 8, 11: 26, 20: 29, 27: 56, 36: 44, 51: 67, 71: 91, 80: 99 };
const SNAKES = { 17: 4, 19: 7, 21: 9, 54: 34, 62: 18, 64: 60, 87: 24, 93: 73, 95: 75, 98: 79 };

// Snakes and Ladders: roll on your turn, exact landing on 100 wins. A 6 grants another roll.
class Snakes extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.target = 100;
        this.positions = [0, 0];
        this.lastRoll = null;
        this.rollCount = 0;
    }

    rollDie() {
        return 1 + Math.floor(Math.random() * 6);
    }

    makeMove(playerIndex, move) {
        if (this.isGameOver) {
            return { valid: false, message: "Game is over" };
        }
        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: "Not your turn" };
        }
        if (!move || typeof move !== 'object' || move.action !== 'roll') {
            return { valid: false, message: "Tap Roll to play" };
        }

        const value = this.rollDie();
        const from = this.positions[playerIndex];
        let to = from;
        let via = null;
        const landing = from + value;
        if (landing <= this.target) {
            to = landing;
            if (LADDERS[to] !== undefined) {
                to = LADDERS[to];
                via = 'ladder';
            } else if (SNAKES[to] !== undefined) {
                to = SNAKES[to];
                via = 'snake';
            }
        }
        this.positions[playerIndex] = to;
        this.rollCount++;

        let bonus = false;
        if (to === this.target) {
            this.isGameOver = true;
            this.winner = playerIndex;
        } else if (value === 6) {
            bonus = true; // roll again
        } else {
            this.switchTurn();
        }

        this.lastRoll = { player: playerIndex, value, from, to, via, bonus, n: this.rollCount };

        this.emitState();
        return { valid: true };
    }

    getState() {
        return {
            target: this.target,
            positions: [...this.positions],
            lastRoll: this.lastRoll ? { ...this.lastRoll } : null,
            ladders: { ...LADDERS },
            snakes: { ...SNAKES },
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

Snakes.LADDERS = LADDERS;
Snakes.SNAKES = SNAKES;

module.exports = Snakes;
