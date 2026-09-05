const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const TicTacToe = require('../games/tictactoe');
const Battleship = require('../games/battleship');
const Mastermind = require('../games/mastermind');
const RPS = require('../games/rps');
const DotsAndBoxes = require('../games/dotsandboxes');
const GameManager = require('../game-manager');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

describe('TicTacToe', () => {
    it('rejects out-of-range cells', () => {
        const game = new TicTacToe('r', [fakeSocket('a'), fakeSocket('b')], 0);
        assert.equal(game.makeMove(0, { index: 9 }).valid, false);
        assert.equal(game.makeMove(0, { index: -1 }).valid, false);
    });

    it('awards a winning line', () => {
        const game = new TicTacToe('r', [fakeSocket('a'), fakeSocket('b')], 0);
        game.makeMove(0, { index: 0 });
        game.makeMove(1, { index: 3 });
        game.makeMove(0, { index: 1 });
        game.makeMove(1, { index: 4 });
        const result = game.makeMove(0, { index: 2 });
        assert.equal(result.valid, true);
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 0);
    });
});

describe('Battleship fog of war', () => {
    it('hides unhit opponent ships from the viewer', () => {
        const game = new Battleship('r', [fakeSocket('a'), fakeSocket('b')], 0);
        const p0 = game.getStateForPlayer(0);
        const p1viewOfP0 = p0.grids[1];
        const rawOpp = game.grids[1];
        const leaked = p1viewOfP0.some((row, r) => row.some((cell, c) => cell === 1 && rawOpp[r][c] === 1));
        assert.equal(leaked, false);
        const ownShipsVisible = p0.grids[0].some(row => row.includes(1));
        assert.equal(ownShipsVisible, true);
    });
});

describe('Mastermind secrets', () => {
    it('does not send the code to the breaker until the game ends', () => {
        const game = new Mastermind('r', [fakeSocket('a'), fakeSocket('b')], 0, null);
        game.makeMove(game.makerIndex, { code: [1, 2, 3, 4] });
        const breakerView = game.getStateForPlayer(game.breakerIndex);
        assert.deepEqual(breakerView.secretCode, []);
        const makerView = game.getStateForPlayer(game.makerIndex);
        assert.deepEqual(makerView.secretCode, [1, 2, 3, 4]);
    });
});

describe('Rock Paper Scissors', () => {
    it('does not leak the opponent choice mid-round', () => {
        const game = new RPS('r', [fakeSocket('a'), fakeSocket('b')], 0);
        game.makeMove(0, { choice: 'rock' });
        const p1 = game.getStateForPlayer(1);
        assert.equal(p1.myChoice, null);
        assert.equal(p1.opponentReady, true);
        assert.equal(p1.lastRound, null);
    });

    it('ends when a player wins two rounds', () => {
        const game = new RPS('r', [fakeSocket('a'), fakeSocket('b')], 0);
        game.makeMove(0, { choice: 'rock' });
        game.makeMove(1, { choice: 'scissors' });
        game.makeMove(0, { choice: 'paper' });
        game.makeMove(1, { choice: 'rock' });
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 0);
        assert.deepEqual(game.roundWins, [2, 0]);
    });
});

describe('Dots and Boxes', () => {
    it('honors the starting player', () => {
        const game = new DotsAndBoxes('r', [fakeSocket('a'), fakeSocket('b')], 1);
        assert.equal(game.activePlayerIndex, 1);
        assert.equal(game.makeMove(0, { type: 'h', row: 0, col: 0 }).valid, false);
        assert.equal(game.makeMove(1, { type: 'h', row: 0, col: 0 }).valid, true);
    });
});

describe('GameManager', () => {
    it('rejects unknown game types', () => {
        const errors = [];
        const gm = new GameManager({ to() { return { emit() {} }; } });
        const socket = {
            id: 's1',
            emit(event, payload) { if (event === 'error') errors.push(payload); },
            join() {}
        };
        gm.createRoom(socket, 'not-a-game', 'Ada');
        assert.deepEqual(errors, ['Unknown game type']);
        assert.equal(gm.rooms.size, 0);
    });

    it('updates the scoreboard when a game ends without a make_move caller', () => {
        const gm = new GameManager({ to() { return { emit() {} }; } });
        const p0 = fakeSocket('a');
        const p1 = fakeSocket('b');
        gm.rooms.set('ROOM01', {
            players: [p0, p1],
            names: ['A', 'B'],
            game: null,
            type: 'rps',
            status: 'ready',
            scores: [0, 0],
            playAgain: [false, false]
        });
        gm.startGame('ROOM01', 0);
        const game = gm.rooms.get('ROOM01').game;
        game.makeMove(0, { choice: 'rock' });
        game.makeMove(1, { choice: 'scissors' });
        game.makeMove(0, { choice: 'rock' });
        game.makeMove(1, { choice: 'scissors' });
        assert.equal(game.isGameOver, true);
        assert.deepEqual(gm.rooms.get('ROOM01').scores, [1, 0]);
    });
});
