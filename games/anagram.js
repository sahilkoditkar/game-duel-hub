const BaseGame = require('./base-game');
const { WORDS } = require('./wordchain');

const LETTER_COUNT = 9;
const ROUND_TIME = 60; // seconds
const MIN_WORD_LENGTH = 3;
const MIN_FORMABLE_WORDS = 12;
const MAX_REROLLS = 200;

const VOWELS = 'aeiou';
// Consonants weighted toward common letters (repeats = higher chance).
const CONSONANT_POOL = 'rrrsssttlllnnnddcccmmpphhggbbffyywkv';

const CANDIDATE_WORDS = [...WORDS].filter(w => w.length >= MIN_WORD_LENGTH && w.length <= LETTER_COUNT);

function letterCounts(letters) {
    const counts = {};
    for (const ch of letters) counts[ch] = (counts[ch] || 0) + 1;
    return counts;
}

// True when `word` can be spelled from `letters` without using any letter more often than it appears.
function canForm(word, letters) {
    const counts = letterCounts(letters);
    for (const ch of word) {
        if (!counts[ch]) return false;
        counts[ch]--;
    }
    return true;
}

function formableWords(letters) {
    return CANDIDATE_WORDS.filter(w => canForm(w, letters));
}

function pick(str) {
    return str[Math.floor(Math.random() * str.length)];
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function drawLetters() {
    const vowelCount = 3 + Math.floor(Math.random() * 2); // 3 or 4
    const letters = [];
    for (let i = 0; i < vowelCount; i++) letters.push(pick(VOWELS));
    while (letters.length < LETTER_COUNT) letters.push(pick(CONSONANT_POOL));
    return shuffle(letters);
}

// Reroll until the rack allows at least MIN_FORMABLE_WORDS words; keep the best rack if unlucky.
function drawPlayableLetters() {
    let best = null;
    let bestCount = -1;
    for (let attempt = 0; attempt < MAX_REROLLS; attempt++) {
        const letters = drawLetters();
        const count = formableWords(letters).length;
        if (count >= MIN_FORMABLE_WORDS) return letters;
        if (count > bestCount) {
            bestCount = count;
            best = letters;
        }
    }
    return best;
}

class Anagram extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.letters = drawPlayableLetters(); // array of 9 lowercase chars
        this.roundTime = ROUND_TIME;
        this.timeLeft = ROUND_TIME;
        this.found = [[], []]; // per player: { word, points }
        this.foundSets = [new Set(), new Set()];
        this.scores = [0, 0];
        this.started = false; // clock only runs once both clients are ready
        this.paused = false;
        this.timer = null;
        this.activePlayerIndex = null; // simultaneous
        this.gameState = { letters: this.letters, scores: this.scores };
    }

    // Called by the GameManager once both players report ready (or after a fallback delay).
    start() {
        if (this.started || this.isGameOver) return;
        this.started = true;
        this.runTimer();
        this.emitState();
    }

    pause() {
        if (!this.started || this.isGameOver) return;
        this.paused = true;
        this.clearTimer();
        this.emitState();
    }

    resume() {
        if (!this.started || this.isGameOver || !this.paused) return;
        this.paused = false;
        this.runTimer();
        this.emitState();
    }

    runTimer() {
        this.clearTimer();
        this.timer = setInterval(() => this.tick(), 1000);
    }

    // One clock second. Split out so tests can drive the clock without waiting.
    tick() {
        if (this.isGameOver) {
            this.clearTimer();
            return;
        }
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        if (this.timeLeft <= 0) {
            this.clearTimer();
            this.finish();
        }
        this.emitState();
    }

    finish() {
        this.isGameOver = true;
        if (this.scores[0] > this.scores[1]) this.winner = 0;
        else if (this.scores[1] > this.scores[0]) this.winner = 1;
        else this.winner = 'draw';
    }

    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    cleanup() {
        this.clearTimer();
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

        const raw = move && move.word;
        if (typeof raw !== 'string') {
            return { valid: false, message: 'Type a word' };
        }
        const word = raw.trim().toLowerCase();
        if (!/^[a-z]+$/.test(word)) {
            return { valid: false, message: 'Letters only, one word' };
        }
        if (word.length < MIN_WORD_LENGTH) {
            return { valid: false, message: `At least ${MIN_WORD_LENGTH} letters` };
        }
        if (!canForm(word, this.letters)) {
            return { valid: false, message: 'Use only the given letters' };
        }
        if (!WORDS.has(word)) {
            return { valid: false, message: 'Not in word list' };
        }
        if (this.foundSets[playerIndex].has(word)) {
            return { valid: false, message: 'You already found that word' };
        }

        const points = word.length;
        this.found[playerIndex].push({ word, points });
        this.foundSets[playerIndex].add(word);
        this.scores[playerIndex] += points;

        this.emitState();
        return { valid: true };
    }

    // Public view: scores and counts only (no word lists until the game is over).
    getState() {
        return {
            letters: this.letters.join(''),
            scores: this.scores.slice(),
            wordCounts: [this.found[0].length, this.found[1].length],
            timeLeft: this.timeLeft,
            roundTime: this.roundTime,
            started: this.started,
            paused: this.paused,
            activePlayerIndex: null,
            isGameOver: this.isGameOver,
            winner: this.winner,
            allWords: this.isGameOver ? [this.found[0].slice(), this.found[1].slice()] : undefined
        };
    }

    getStateForPlayer(playerIndex) {
        const opp = 1 - playerIndex;
        const state = {
            letters: this.letters.join(''),
            myWords: this.found[playerIndex].map(f => ({ word: f.word, points: f.points })),
            myScore: this.scores[playerIndex],
            oppScore: this.scores[opp],
            oppWordCount: this.found[opp].length,
            timeLeft: this.timeLeft,
            roundTime: this.roundTime,
            started: this.started,
            paused: this.paused,
            activePlayerIndex: null,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
        if (this.isGameOver) {
            state.allWords = [this.found[0].slice(), this.found[1].slice()];
        }
        return state;
    }
}

module.exports = Anagram;
module.exports.canForm = canForm;
module.exports.formableWords = formableWords;
module.exports.drawLetters = drawLetters;
module.exports.drawPlayableLetters = drawPlayableLetters;
