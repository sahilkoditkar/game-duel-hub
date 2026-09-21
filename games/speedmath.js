const BaseGame = require('./base-game');

const WINS_NEEDED = 3;
const REVEAL_MS = 2000;
const ANSWER_LIMIT = 1000000; // answers are small; anything wilder is malformed

class SpeedMath extends BaseGame {
    // options (optional, tests only): { rng: () => [0,1) }
    constructor(id, players, startingPlayerIndex, options) {
        super(id, players, startingPlayerIndex);
        const opts = options && typeof options === 'object' ? options : {};
        this.rng = typeof opts.rng === 'function' ? opts.rng : Math.random;

        this.round = 1;
        this.roundWins = [0, 0];
        this.winsNeeded = WINS_NEEDED;
        this.locked = [false, false];
        this.lastRound = null;
        this.phase = 'question'; // 'question' | 'reveal'
        this.revealTimeout = null;
        this.revealMs = REVEAL_MS;
        this.activePlayerIndex = null;

        this.newQuestion();
    }

    randInt(min, max) {
        return min + Math.floor(this.rng() * (max - min + 1));
    }

    // Difficulty climbs with the round number.
    generateQuestion(round) {
        if (round <= 2) {
            const a = this.randInt(10, 99);
            const b = this.randInt(10, 99);
            return { text: `${a} + ${b}`, answer: a + b };
        }
        if (round === 3) {
            const a = this.randInt(11, 99);
            const b = this.randInt(10, a - 1);
            return { text: `${a} - ${b}`, answer: a - b };
        }
        if (round === 4) {
            const a = this.randInt(2, 12);
            const b = this.randInt(2, 12);
            return { text: `${a} × ${b}`, answer: a * b };
        }
        const a = this.randInt(2, 12);
        const b = this.randInt(2, 12);
        const c = this.randInt(10, 99);
        return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
    }

    newQuestion() {
        const q = this.generateQuestion(this.round);
        this.question = q.text;
        this.answer = q.answer;
        this.locked = [false, false];
        this.phase = 'question';
    }

    makeMove(playerIndex, moveData) {
        if (this.isGameOver) {
            return { valid: false, message: 'Game is over' };
        }
        if (this.phase !== 'question') {
            return { valid: false, message: 'Wait for the next question' };
        }
        const answer = moveData ? moveData.answer : undefined;
        if (!BaseGame.isIntInRange(answer, -ANSWER_LIMIT, ANSWER_LIMIT)) {
            return { valid: false, message: 'Enter a whole number' };
        }
        if (this.locked[playerIndex]) {
            return { valid: false, message: 'Locked out this round' };
        }

        if (answer === this.answer) {
            this.endRound(playerIndex);
            this.emitState();
            return { valid: true };
        }

        // A wrong answer is a real move (it locks you out) but the player still gets a toast.
        this.locked[playerIndex] = true;
        if (this.locked[0] && this.locked[1]) {
            this.endRound(null);
        }
        this.emitState();
        return { valid: false, message: 'Wrong! Locked out this round' };
    }

    // winner: 0 | 1 | null (both locked out: void round, same round number is replayed)
    endRound(winner) {
        this.lastRound = { question: this.question, answer: this.answer, winner, round: this.round };
        this.phase = 'reveal';
        if (winner !== null) {
            this.roundWins[winner]++;
            if (this.roundWins[winner] >= this.winsNeeded) {
                this.isGameOver = true;
                this.winner = winner;
                this.clearRevealTimeout();
                return;
            }
        }
        this.clearRevealTimeout();
        this.revealTimeout = setTimeout(() => {
            this.revealTimeout = null;
            this.nextRound();
        }, this.revealMs);
    }

    nextRound() {
        if (this.isGameOver || this.phase !== 'reveal') return;
        if (this.lastRound && this.lastRound.winner !== null) this.round++;
        this.newQuestion();
        this.emitState();
    }

    clearRevealTimeout() {
        if (this.revealTimeout) {
            clearTimeout(this.revealTimeout);
            this.revealTimeout = null;
        }
    }

    cleanup() {
        this.clearRevealTimeout();
    }

    getState() {
        return this.getStateForPlayer(0);
    }

    getStateForPlayer(playerIndex) {
        return {
            round: this.round,
            roundWins: this.roundWins.slice(),
            winsNeeded: this.winsNeeded,
            question: this.question,
            myLocked: this.locked[playerIndex],
            oppLocked: this.locked[1 - playerIndex],
            lastRound: this.lastRound,
            phase: this.phase,
            activePlayerIndex: null,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = SpeedMath;
