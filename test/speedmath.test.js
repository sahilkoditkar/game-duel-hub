const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const SpeedMath = require('../games/speedmath');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}
const sockets = () => [fakeSocket('a'), fakeSocket('b')];

// rng always 0 -> randInt returns its minimum: fully deterministic questions.
const minRng = () => 0;
const newGame = (rng = minRng) => new SpeedMath('r', sockets(), 0, { rng });

describe('SpeedMath questions', () => {
    it('rises in difficulty with the round number', () => {
        const game = newGame();
        assert.deepEqual(game.generateQuestion(1), { text: '10 + 10', answer: 20 });
        assert.deepEqual(game.generateQuestion(2), { text: '10 + 10', answer: 20 });
        assert.deepEqual(game.generateQuestion(3), { text: '11 - 10', answer: 1 });
        assert.deepEqual(game.generateQuestion(4), { text: '2 × 2', answer: 4 });
        assert.deepEqual(game.generateQuestion(5), { text: '2 × 2 + 10', answer: 14 });
        game.cleanup();
    });

    it('generates questions whose answers match their text', () => {
        const game = new SpeedMath('r', sockets(), 0);
        for (let round = 1; round <= 5; round++) {
            for (let i = 0; i < 50; i++) {
                const q = game.generateQuestion(round);
                const evaluated = Function(`return ${q.text.replace(/×/g, '*')}`)();
                assert.equal(q.answer, evaluated, q.text);
                if (round === 3) assert.ok(q.answer > 0, 'subtraction stays positive');
                if (round === 4) assert.match(q.text, /^(\d+) × (\d+)$/);
            }
        }
        const [a, b] = game.generateQuestion(4).text.split(' × ').map(Number);
        assert.ok(a >= 2 && a <= 12 && b >= 2 && b <= 12);
        game.cleanup();
    });

    it('starts in the question phase with a hidden answer', () => {
        const game = newGame();
        const s = game.getStateForPlayer(0);
        assert.equal(s.phase, 'question');
        assert.equal(s.round, 1);
        assert.equal(s.question, '10 + 10');
        assert.equal(s.winsNeeded, 3);
        assert.equal(s.lastRound, null);
        assert.equal(s.myLocked, false);
        assert.equal(s.oppLocked, false);
        assert.equal(s.activePlayerIndex, null);
        assert.equal(Object.prototype.hasOwnProperty.call(s, 'answer'), false, 'answer must not leak');
        assert.equal(JSON.stringify(s).includes('20'), false);
        assert.equal(game.revealTimeout, null);
        game.cleanup();
    });
});

describe('SpeedMath rounds', () => {
    it('first correct answer wins the round and the next question appears after 2 seconds', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const game = newGame();
        const r = game.makeMove(1, { answer: 20 });
        assert.equal(r.valid, true);
        assert.equal(game.phase, 'reveal');
        assert.deepEqual(game.roundWins, [0, 1]);
        assert.deepEqual(game.lastRound, { question: '10 + 10', answer: 20, winner: 1, round: 1 });
        assert.equal(game.makeMove(0, { answer: 20 }).valid, false, 'too late');
        t.mock.timers.tick(1999);
        assert.equal(game.round, 1);
        t.mock.timers.tick(1);
        assert.equal(game.round, 2);
        assert.equal(game.phase, 'question');
        assert.equal(game.revealTimeout, null);
        assert.deepEqual(game.locked, [false, false]);
        const s = game.getStateForPlayer(0);
        assert.equal(s.lastRound.winner, 1, 'last result stays visible');
        game.cleanup();
    });

    it('a wrong answer locks that player out for the round', () => {
        const game = newGame();
        const wrong = game.makeMove(0, { answer: 21 });
        assert.equal(wrong.valid, false);
        assert.match(wrong.message, /wrong.*locked out/i);
        assert.equal(game.getStateForPlayer(0).myLocked, true);
        assert.equal(game.getStateForPlayer(1).oppLocked, true);
        assert.equal(game.getStateForPlayer(1).myLocked, false);
        const retry = game.makeMove(0, { answer: 20 });
        assert.equal(retry.valid, false, 'no second chance even with the right answer');
        assert.equal(game.phase, 'question');
        assert.equal(game.makeMove(1, { answer: 20 }).valid, true);
        assert.deepEqual(game.roundWins, [0, 1]);
        game.cleanup();
    });

    it('voids the round when both are locked out and replays the same round number', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        let calls = 0;
        const rng = () => (calls++ < 2 ? 0 : 0.5); // first question 10+10, later ones differ
        const game = newGame(rng);
        game.makeMove(0, { answer: 1 });
        game.makeMove(1, { answer: 2 });
        assert.equal(game.phase, 'reveal');
        assert.equal(game.lastRound.winner, null);
        assert.deepEqual(game.roundWins, [0, 0]);
        t.mock.timers.tick(2000);
        assert.equal(game.round, 1, 'void round does not advance the round counter');
        assert.equal(game.phase, 'question');
        assert.notEqual(game.question, '10 + 10', 'a new question is generated');
        assert.deepEqual(game.locked, [false, false]);
        game.cleanup();
    });

    it('plays a full match to 3 round wins', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const game = newGame();
        const results = [0, 1, 0, 1, 0];
        for (let i = 0; i < results.length; i++) {
            assert.equal(game.round, i + 1);
            assert.equal(game.makeMove(results[i], { answer: game.answer }).valid, true);
            if (i < results.length - 1) {
                assert.equal(game.isGameOver, false);
                t.mock.timers.tick(2000);
            }
        }
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 0);
        assert.deepEqual(game.roundWins, [3, 2]);
        assert.equal(game.phase, 'reveal');
        assert.equal(game.revealTimeout, null, 'no next round scheduled after the match');
        t.mock.timers.tick(5000);
        assert.equal(game.round, 5);
        assert.equal(game.makeMove(1, { answer: game.answer }).valid, false);
        game.cleanup();
    });

    it('cleanup() cancels the pending next round', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const game = newGame();
        game.makeMove(0, { answer: 20 });
        assert.notEqual(game.revealTimeout, null);
        game.cleanup();
        assert.equal(game.revealTimeout, null);
        t.mock.timers.tick(5000);
        assert.equal(game.round, 1);
    });
});

describe('SpeedMath malformed moves', () => {
    it('rejects non-integers and junk without throwing or locking the player', () => {
        const game = newGame();
        for (const move of [{}, null, undefined, { answer: 20.5 }, { answer: '20' }, { answer: NaN }, { answer: Infinity }, { answer: [20] }, { answer: null }, { answer: 1e12 }]) {
            let result;
            assert.doesNotThrow(() => { result = game.makeMove(0, move); });
            assert.equal(result.valid, false, JSON.stringify(move));
        }
        assert.deepEqual(game.locked, [false, false], 'malformed input is not a wrong answer');
        assert.equal(game.phase, 'question');
        game.cleanup();
    });
});
