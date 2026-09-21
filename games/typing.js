const BaseGame = require('./base-game');

const TIME_LIMIT = 120; // seconds after start()
const MAX_TEXT_LENGTH = 400;

// Plain ASCII, 8-14 common words each, commas only, one final period.
const SENTENCES = [
    'The quick brown fox jumps over the lazy dog every morning.',
    'She opened the window and let the cool air fill the room.',
    'We packed our bags the night before the long trip north.',
    'The old clock on the wall ticked slowly through the afternoon.',
    'He poured a cup of coffee and sat down to read the paper.',
    'A small boat drifted across the calm lake at sunrise.',
    'The children ran through the park, laughing at the falling leaves.',
    'Please remember to water the plants while we are away.',
    'The train left the station two minutes early this morning.',
    'My grandmother keeps her recipes in a blue tin box.',
    'They painted the fence white before the first frost arrived.',
    'The library closes at nine on weekdays and six on weekends.',
    'A warm wind carried the smell of bread down the street.',
    'He fixed the broken chair with a hammer and two nails.',
    'The cat slept on the sunny step until the shadows grew long.',
    'We watched the storm roll in from the edge of the field.',
    'The baker dusted the counter with flour and started again.',
    'Every summer the river runs low and the stones show through.',
    'She wrote her name at the top of the page in blue ink.',
    'The market opens early, so bring a basket and some coins.',
    'A row of tall pines marked the border of the farm.',
    'The bus was late, but the driver still smiled at everyone.',
    'He found an old map folded inside the cover of the book.',
    'The garden gate creaked as the wind pushed it open.',
    'Turn left at the bridge and follow the road to the mill.',
    'The teacher wrote three questions on the board and waited.'
];

// Longest prefix of `text` that matches `target`, case-sensitive. O(n).
function correctPrefixLength(text, target) {
    const n = Math.min(text.length, target.length);
    let i = 0;
    while (i < n && text.charCodeAt(i) === target.charCodeAt(i)) i++;
    return i;
}

class Typing extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.sentence = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
        this.progress = [0, 0];
        this.hasError = [false, false];
        this.timeLimit = TIME_LIMIT;
        this.timeLeft = TIME_LIMIT;
        this.started = false; // clock only runs once both clients are ready
        this.paused = false;
        this.timer = null;
        this.elapsedMs = 0; // accumulated running time (excludes pauses)
        this.runningSince = null; // Date.now() when the clock last started running
        this.activePlayerIndex = null; // simultaneous race
        this.gameState = { sentence: this.sentence, progress: this.progress };
    }

    // Called by the GameManager once both players report ready (or after a fallback delay).
    start() {
        if (this.started || this.isGameOver) return;
        this.started = true;
        this.runClock();
        this.emitState();
    }

    pause() {
        if (!this.started || this.isGameOver) return;
        this.paused = true;
        this.stopClock();
        this.emitState();
    }

    resume() {
        if (!this.started || this.isGameOver || !this.paused) return;
        this.paused = false;
        this.runClock();
        this.emitState();
    }

    runClock() {
        this.clearTimer();
        this.runningSince = Date.now();
        this.timer = setInterval(() => this.tick(), 1000);
    }

    // Freeze elapsed time and stop the interval.
    stopClock() {
        if (this.runningSince !== null) {
            this.elapsedMs += Date.now() - this.runningSince;
            this.runningSince = null;
        }
        this.clearTimer();
    }

    // One clock second. Split out so tests can drive the clock without waiting.
    tick() {
        if (this.isGameOver) {
            this.stopClock();
            return;
        }
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        if (this.timeLeft <= 0) {
            this.stopClock();
            this.finishOnTime();
        }
        this.emitState();
    }

    finishOnTime() {
        this.isGameOver = true;
        if (this.progress[0] > this.progress[1]) this.winner = 0;
        else if (this.progress[1] > this.progress[0]) this.winner = 1;
        else this.winner = 'draw';
    }

    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    cleanup() {
        this.stopClock();
    }

    elapsedSeconds() {
        const running = this.runningSince !== null ? Date.now() - this.runningSince : 0;
        return (this.elapsedMs + running) / 1000;
    }

    // Words per minute with the standard 5-chars-per-word convention.
    wpm(playerIndex) {
        const elapsed = this.elapsedSeconds();
        if (elapsed <= 0) return 0;
        const minutes = Math.max(elapsed, 1) / 60;
        return Math.round((this.progress[playerIndex] / 5) / minutes);
    }

    makeMove(playerIndex, move) {
        if (this.isGameOver) {
            return { valid: false, message: 'Game is over' };
        }
        if (playerIndex !== 0 && playerIndex !== 1) {
            return { valid: false, message: 'Unknown player' };
        }
        if (!this.started) {
            return { valid: false, message: 'Wait for the clock to start' };
        }
        if (this.paused) {
            return { valid: false, message: 'Game is paused while your opponent reconnects' };
        }

        const text = move && move.text;
        if (typeof text !== 'string') {
            return { valid: false, message: 'Send your typed text' };
        }
        if (text.length > MAX_TEXT_LENGTH) {
            return { valid: false, message: 'Text too long' };
        }

        const correct = correctPrefixLength(text, this.sentence);
        this.progress[playerIndex] = correct;
        this.hasError[playerIndex] = text.length > correct;

        if (correct >= this.sentence.length) {
            this.isGameOver = true;
            this.winner = playerIndex;
            this.stopClock();
        }

        this.emitState();
        return { valid: true };
    }

    // Nothing is hidden in a typing race: both players see the same state.
    getState() {
        return {
            sentence: this.sentence,
            progress: this.progress.slice(),
            hasError: this.hasError.slice(),
            wpm: [this.wpm(0), this.wpm(1)],
            timeLeft: this.timeLeft,
            timeLimit: this.timeLimit,
            started: this.started,
            paused: this.paused,
            activePlayerIndex: null,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }

    getStateForPlayer(_playerIndex) {
        return this.getState();
    }
}

module.exports = Typing;
module.exports.SENTENCES = SENTENCES;
module.exports.correctPrefixLength = correctPrefixLength;
