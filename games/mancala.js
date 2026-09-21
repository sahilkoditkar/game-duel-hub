const BaseGame = require('./base-game');

const STORE = [6, 13];
const INITIAL_STONES = 4;

// Mancala (Kalah). 14-slot array: player 0 owns pits 0-5 and store 6,
// player 1 owns pits 7-12 and store 13. Sowing goes counter-clockwise (increasing index).
class Mancala extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.pits = Array(14).fill(INITIAL_STONES);
        this.pits[STORE[0]] = 0;
        this.pits[STORE[1]] = 0;
        this.lastMove = null;
    }

    static ownsPit(playerIndex, index) {
        return index >= playerIndex * 7 && index <= playerIndex * 7 + 5;
    }

    sideEmpty(playerIndex) {
        for (let i = 0; i < 6; i++) {
            if (this.pits[playerIndex * 7 + i] > 0) return false;
        }
        return true;
    }

    makeMove(playerIndex, move) {
        if (this.isGameOver) {
            return { valid: false, message: 'Game is over' };
        }
        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: 'Not your turn' };
        }
        if (!move || typeof move !== 'object') {
            return { valid: false, message: 'Invalid move' };
        }
        const { pit } = move;
        if (!BaseGame.isIntInRange(pit, 0, 5)) {
            return { valid: false, message: 'Pick one of your pits' };
        }
        const start = playerIndex * 7 + pit;
        if (this.pits[start] === 0) {
            return { valid: false, message: 'That pit is empty' };
        }

        const ownStore = STORE[playerIndex];
        const oppStore = STORE[1 - playerIndex];

        let stones = this.pits[start];
        this.pits[start] = 0;
        let index = start;
        while (stones > 0) {
            index = (index + 1) % 14;
            if (index === oppStore) continue;
            this.pits[index]++;
            stones--;
        }

        let captured = 0;
        let extraTurn = false;

        if (index === ownStore) {
            extraTurn = true;
        } else if (Mancala.ownsPit(playerIndex, index) && this.pits[index] === 1) {
            const opposite = 12 - index;
            if (this.pits[opposite] > 0) {
                captured = this.pits[opposite] + 1;
                this.pits[ownStore] += captured;
                this.pits[opposite] = 0;
                this.pits[index] = 0;
            }
        }

        this.lastMove = { player: playerIndex, pit, index: start, captured, extraTurn };

        if (this.sideEmpty(0) || this.sideEmpty(1)) {
            this.finish();
        } else if (!extraTurn) {
            this.switchTurn();
        }

        this.emitState();
        return { valid: true };
    }

    // Sweep every remaining stone into its owner's store and decide the winner.
    finish() {
        for (let p = 0; p < 2; p++) {
            for (let i = 0; i < 6; i++) {
                const idx = p * 7 + i;
                this.pits[STORE[p]] += this.pits[idx];
                this.pits[idx] = 0;
            }
        }
        this.isGameOver = true;
        const s0 = this.pits[STORE[0]];
        const s1 = this.pits[STORE[1]];
        this.winner = s0 === s1 ? 'draw' : (s0 > s1 ? 0 : 1);
    }

    getState() {
        return {
            pits: this.pits,
            stores: [this.pits[STORE[0]], this.pits[STORE[1]]],
            lastMove: this.lastMove,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = Mancala;
