const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Trivia = require('../games/trivia');
const { QUESTION_BANK } = Trivia;

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

const sockets = () => [fakeSocket('a'), fakeSocket('b')];
// rng that never swaps in Fisher-Yates: options keep bank order, so answer index is preserved.
const identityRng = () => 0.999999;

function fixedQuestions(n) {
    const qs = [];
    for (let i = 0; i < n; i++) {
        qs.push({ q: `Question ${i}?`, options: ['right', 'w1', 'w2', 'w3'], answer: 0 });
    }
    return qs;
}

function startedGame(n = 10) {
    const game = new Trivia('r', sockets(), 0, { questions: fixedQuestions(n), rng: identityRng });
    game.start();
    return game;
}

describe('Trivia question bank', () => {
    it('has at least 40 well-formed questions with exactly one correct option', () => {
        assert.ok(QUESTION_BANK.length >= 40, `only ${QUESTION_BANK.length} questions`);
        const seen = new Set();
        for (const entry of QUESTION_BANK) {
            assert.equal(typeof entry.q, 'string');
            assert.ok(entry.q.length > 5);
            assert.ok(Array.isArray(entry.options) && entry.options.length === 4, entry.q);
            assert.equal(new Set(entry.options).size, 4, `duplicate options in: ${entry.q}`);
            assert.ok(Number.isInteger(entry.answer) && entry.answer >= 0 && entry.answer <= 3, entry.q);
            assert.ok(!seen.has(entry.q), `duplicate question: ${entry.q}`);
            seen.add(entry.q);
        }
    });

    it('picks 10 distinct questions and keeps the correct answer when shuffling options', () => {
        const game = new Trivia('r', sockets(), 0);
        assert.equal(game.total, 10);
        assert.equal(game.questions.length, 10);
        assert.equal(new Set(game.questions.map(q => q.q)).size, 10);
        for (const prepared of game.questions) {
            const original = QUESTION_BANK.find(e => e.q === prepared.q);
            assert.ok(original);
            assert.equal(prepared.options[prepared.correctIndex], original.options[original.answer]);
            assert.deepEqual(prepared.options.slice().sort(), original.options.slice().sort());
        }
        game.cleanup();
    });

    it('draws different sets across games (randomness is server-side)', () => {
        const seen = new Set();
        for (let i = 0; i < 8; i++) {
            const g = new Trivia('r', sockets(), 0);
            seen.add(g.questions.map(q => q.q).join('|'));
            g.cleanup();
        }
        assert.ok(seen.size > 1);
    });
});

describe('Trivia clock', () => {
    it('does not start a timer in the constructor and rejects answers before start()', () => {
        const game = new Trivia('r', sockets(), 0, { questions: fixedQuestions(10), rng: identityRng });
        assert.equal(game.timer, null);
        assert.equal(game.advanceTimeout, null);
        const s = game.getStateForPlayer(0);
        assert.equal(s.started, false);
        assert.equal(s.question, null, 'question is hidden until the clock starts');
        const r = game.makeMove(0, { answer: 0 });
        assert.equal(r.valid, false);
        game.start();
        assert.notEqual(game.timer, null);
        assert.equal(game.getStateForPlayer(0).question.q, 'Question 0?');
        game.cleanup();
        assert.equal(game.timer, null);
    });

    it('counts down and resolves the question when time runs out', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
        const game = startedGame();
        assert.equal(game.timeLeft, 15);
        t.mock.timers.tick(3000);
        assert.equal(game.timeLeft, 12);
        game.makeMove(0, { answer: 0 });
        t.mock.timers.tick(12000);
        assert.equal(game.phase, 'reveal');
        assert.deepEqual(game.lastResult, { correctIndex: 0, answers: [0, null] });
        assert.deepEqual(game.scores, [1, 0]);
        assert.equal(game.timer, null);
        t.mock.timers.tick(2500);
        assert.equal(game.phase, 'answering');
        assert.equal(game.questionIndex, 1);
        assert.equal(game.timeLeft, 15);
        assert.deepEqual(game.answers, [null, null]);
        game.cleanup();
    });

    it('pause() freezes the clock and resume() continues from the remaining time', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
        const game = startedGame();
        t.mock.timers.tick(5000);
        game.pause();
        assert.equal(game.timer, null);
        assert.equal(game.getStateForPlayer(0).paused, true);
        assert.equal(game.makeMove(0, { answer: 0 }).valid, false);
        t.mock.timers.tick(20000);
        assert.equal(game.timeLeft, 10, 'no ticks while paused');
        assert.equal(game.phase, 'answering');
        game.resume();
        assert.notEqual(game.timer, null);
        t.mock.timers.tick(1000);
        assert.equal(game.timeLeft, 9);
        game.cleanup();
    });

    it('pause() during the reveal holds the next question until resume()', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
        const game = startedGame();
        game.makeMove(0, { answer: 0 });
        game.makeMove(1, { answer: 1 });
        assert.equal(game.phase, 'reveal');
        assert.notEqual(game.advanceTimeout, null);
        game.pause();
        assert.equal(game.advanceTimeout, null);
        t.mock.timers.tick(10000);
        assert.equal(game.questionIndex, 0);
        game.resume();
        t.mock.timers.tick(2500);
        assert.equal(game.questionIndex, 1);
        assert.equal(game.phase, 'answering');
        game.cleanup();
    });

    it('cleanup() clears both the interval and the advance timeout', () => {
        const game = startedGame();
        game.makeMove(0, { answer: 0 });
        game.makeMove(1, { answer: 0 });
        assert.notEqual(game.advanceTimeout, null);
        game.cleanup();
        assert.equal(game.timer, null);
        assert.equal(game.advanceTimeout, null);
    });
});

describe('Trivia rules', () => {
    it('plays a full game: higher score wins', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
        const game = startedGame();
        for (let i = 0; i < 10; i++) {
            assert.equal(game.phase, 'answering');
            assert.equal(game.questionIndex, i);
            assert.equal(game.makeMove(0, { answer: 0 }).valid, true);
            // player 1 gets the first 4 right only
            assert.equal(game.makeMove(1, { answer: i < 4 ? 0 : 2 }).valid, true);
            assert.equal(game.phase, 'reveal');
            t.mock.timers.tick(2500);
        }
        assert.equal(game.isGameOver, true);
        assert.equal(game.phase, 'finished');
        assert.equal(game.winner, 0);
        assert.deepEqual(game.scores, [10, 4]);
        assert.equal(game.timer, null);
        assert.equal(game.advanceTimeout, null);
        const s = game.getStateForPlayer(1);
        assert.equal(s.isGameOver, true);
        assert.equal(s.correctIndex, 0);
        game.cleanup();
    });

    it('ends in a draw when scores are equal', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
        const game = startedGame();
        for (let i = 0; i < 10; i++) {
            game.makeMove(0, { answer: i % 2 === 0 ? 0 : 3 });
            game.makeMove(1, { answer: i % 2 === 0 ? 3 : 0 });
            t.mock.timers.tick(2500);
        }
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 'draw');
        assert.deepEqual(game.scores, [5, 5]);
        game.cleanup();
    });

    it('lets each player answer only once per question', () => {
        const game = startedGame();
        assert.equal(game.makeMove(0, { answer: 2 }).valid, true);
        const again = game.makeMove(0, { answer: 0 });
        assert.equal(again.valid, false);
        assert.match(again.message, /already answered/i);
        assert.equal(game.answers[0], 2, 'the first answer stands');
        game.cleanup();
    });

    it('rejects answers during the reveal', () => {
        const game = startedGame();
        game.makeMove(0, { answer: 0 });
        game.makeMove(1, { answer: 0 });
        assert.equal(game.phase, 'reveal');
        assert.equal(game.makeMove(0, { answer: 0 }).valid, false);
        game.cleanup();
    });

    it('rejects malformed moves without throwing', () => {
        const game = startedGame();
        for (const move of [{}, null, undefined, { answer: 1.5 }, { answer: '1' }, { answer: 4 }, { answer: -1 }, { answer: null }, { answer: [0] }]) {
            let result;
            assert.doesNotThrow(() => { result = game.makeMove(0, move); });
            assert.equal(result.valid, false, JSON.stringify(move));
        }
        assert.deepEqual(game.answers, [null, null]);
        game.cleanup();
    });

    it('rejects moves after the game is over', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
        const game = startedGame(1);
        game.makeMove(0, { answer: 0 });
        game.makeMove(1, { answer: 0 });
        t.mock.timers.tick(2500);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 'draw');
        assert.equal(game.makeMove(0, { answer: 0 }).valid, false);
        game.cleanup();
    });
});

describe('Trivia hidden information', () => {
    it('never shows the correct answer or the opponent pick while answering', () => {
        const game = startedGame();
        game.makeMove(1, { answer: 3 });
        const s0 = game.getStateForPlayer(0);
        assert.equal(s0.phase, 'answering');
        assert.equal(s0.correctIndex, null);
        assert.equal(s0.lastResult, null);
        assert.equal(s0.myAnswer, null);
        assert.equal(s0.opponentAnswered, true);
        assert.equal(JSON.stringify(s0).includes('"answers"'), false);
        assert.equal(JSON.stringify(s0).includes('correctIndex":3'), false);
        const s1 = game.getStateForPlayer(1);
        assert.equal(s1.myAnswer, 3);
        assert.equal(s1.opponentAnswered, false);
        assert.equal(s1.activePlayerIndex, null);
        assert.equal(s1.total, 10);
        game.cleanup();
    });

    it('reveals the correct answer and both picks after resolution', () => {
        const game = startedGame();
        game.makeMove(0, { answer: 0 });
        game.makeMove(1, { answer: 2 });
        const s = game.getStateForPlayer(1);
        assert.equal(s.phase, 'reveal');
        assert.equal(s.correctIndex, 0);
        assert.deepEqual(s.lastResult, { correctIndex: 0, answers: [0, 2] });
        assert.deepEqual(s.scores, [1, 0]);
        game.cleanup();
    });
});
