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

// ---------------------------------------------------------------------------
// Regression tests for the "bugs that hit real players" fixes
// ---------------------------------------------------------------------------

function makeIo() {
    return { to() { return { emit() {} }; } };
}

function recordingSocket(id) {
    const events = [];
    return {
        id,
        connected: true,
        events,
        emit(event, payload) { events.push([event, payload]); },
        join() {},
        leave() {}
    };
}

function setupRoom(gm, type = 'tictactoe') {
    const a = recordingSocket('a');
    const b = recordingSocket('b');
    gm.createRoom(a, type, 'Alice');
    const roomId = a.events.find(([e]) => e === 'room_created')[1].roomId;
    gm.joinRoom(b, roomId, 'Bob');
    return { a, b, roomId, room: gm.rooms.get(roomId) };
}

describe('Malformed moves never throw', () => {
    const sockets = [fakeSocket('a'), fakeSocket('b')];
    const cases = [
        ['connectfour', {}], ['connectfour', { col: 1.5 }], ['connectfour', { col: '3' }],
        ['dotsandboxes', { type: 'h', row: 1.5, col: 0 }], ['dotsandboxes', { type: 'h' }],
        ['nim', { row: 3, count: 0.5 }], ['nim', {}],
        ['bingo', { number: '5' }], ['bingo', { number: 2.5 }],
        ['battleship', {}], ['battleship', { row: 'a', col: 0 }],
        ['hangman', { letter: '1' }], ['hangman', {}],
        ['memory', {}], ['memory', { index: 3.3 }],
        ['reversi', {}], ['reversi', { row: 9, col: 0 }],
        ['checkers', {}], ['checkers', { fromRow: 2.5, fromCol: 1, toRow: 3, toCol: 2 }],
        ['mastermind', { code: 'abcd' }], ['mastermind', { code: [1, 2, 3] }],
        ['wordchain', {}], ['wordchain', { word: 42 }],
        ['tictactoe', {}]
    ];
    for (const [type, move] of cases) {
        it(`${type} rejects ${JSON.stringify(move)} without throwing`, () => {
            const Game = require('../games/' + type);
            const game = type === 'wordchain'
                ? new Game('r', sockets, 0, makeIo())
                : new Game('r', sockets, 0, null);
            if (type === 'mastermind') game.activePlayerIndex = game.makerIndex;
            const result = game.makeMove(game.activePlayerIndex, move);
            assert.equal(result.valid, false);
            if (typeof game.cleanup === 'function') game.cleanup();
        });
    }

    it('GameManager.handleMove survives a missing payload and a bad move shape', () => {
        const gm = new GameManager(makeIo(), { graceMs: 0 });
        const { a, roomId } = setupRoom(gm);
        assert.doesNotThrow(() => gm.handleMove(a, undefined));
        assert.doesNotThrow(() => gm.handleMove(a, null));
        assert.doesNotThrow(() => gm.handleMove(a, 'nope'));
        assert.doesNotThrow(() => gm.handleMove(a, { roomId, move: 'nope' }));
        assert.doesNotThrow(() => gm.handleRestart(a, undefined));
        assert.doesNotThrow(() => gm.handleReady(a, undefined));
        assert.ok(a.events.some(([e]) => e === 'invalid_move'));
    });
});

describe('Seat handling when a player leaves for good', () => {
    it('keeps the remaining player\'s name and score when the host leaves', () => {
        const gm = new GameManager(makeIo(), { graceMs: 0 });
        const { a, b, roomId, room } = setupRoom(gm);
        room.scores[0] = 3;
        room.scores[1] = 1;
        gm.handleDisconnect(a); // graceMs 0 => removed immediately

        const left = b.events.filter(([e]) => e === 'player_left').pop()[1];
        assert.equal(left.yourIndex, 0);
        assert.deepEqual(room.names, ['Bob', 'Player 2']);
        assert.deepEqual(room.scores, [1, 0]);
        assert.equal(room.status, 'waiting');

        const c = recordingSocket('c');
        gm.joinRoom(c, roomId, 'Carol');
        assert.deepEqual(room.names, ['Bob', 'Carol']);
        assert.deepEqual(room.scores, [1, 0]);
        const start = b.events.filter(([e]) => e === 'game_start').pop()[1];
        assert.equal(start.playerIndex, 0);
        assert.equal(start.names[start.playerIndex], 'Bob');
    });

    it('deletes the room once everyone is gone', () => {
        const gm = new GameManager(makeIo(), { graceMs: 0 });
        const { a, b, roomId } = setupRoom(gm);
        gm.handleDisconnect(a);
        gm.handleDisconnect(b);
        assert.equal(gm.rooms.has(roomId), false);
    });
});

describe('Reconnect grace period', () => {
    it('lets a player resume with their token and keeps the game alive', async () => {
        const gm = new GameManager(makeIo(), { graceMs: 200 });
        const { a, b, roomId, room } = setupRoom(gm);
        const token = a.events.find(([e]) => e === 'room_created')[1].token;
        room.game.makeMove(0, { index: 4 });

        gm.handleDisconnect(a);
        assert.equal(room.players.length, 2, 'seat is held during grace');
        assert.equal(room.disconnected[0], true);
        assert.ok(b.events.some(([e]) => e === 'opponent_disconnected'));
        assert.equal(room.game.isGameOver, false);

        const a2 = recordingSocket('a2');
        gm.rejoinRoom(a2, roomId, token);
        assert.equal(room.players[0], a2);
        assert.equal(room.game.players[0], a2, 'game sees the new socket too');
        const rejoined = a2.events.find(([e]) => e === 'room_rejoined')[1];
        assert.equal(rejoined.playerIndex, 0);
        const start = a2.events.find(([e]) => e === 'game_start')[1];
        assert.equal(start.resumed, true);
        assert.equal(start.initialState.gameState.board[4], 'X');
        assert.ok(b.events.some(([e]) => e === 'opponent_reconnected'));

        // Moves work again for the new socket
        gm.handleMove(a2, { roomId, move: { index: 0 } });
        assert.equal(room.game.gameState.board[0], null, 'it is B\'s turn, so rejected');
        gm.handleMove(b, { roomId, move: { index: 0 } });
        assert.equal(room.game.gameState.board[0], 'O');

        await new Promise(r => setTimeout(r, 300));
        assert.equal(room.players.length, 2, 'expired grace timer must not evict the rejoined player');
    });

    it('frees the seat after the grace period expires', async () => {
        const gm = new GameManager(makeIo(), { graceMs: 50 });
        const { a, b, room } = setupRoom(gm);
        gm.handleDisconnect(a);
        await new Promise(r => setTimeout(r, 120));
        assert.equal(room.players.length, 1);
        assert.equal(room.players[0], b);
        assert.equal(room.game, null);
        assert.ok(b.events.some(([e]) => e === 'player_left'));
    });

    it('rejects a bad token', () => {
        const gm = new GameManager(makeIo(), { graceMs: 200 });
        const { a, roomId } = setupRoom(gm);
        gm.handleDisconnect(a);
        const x = recordingSocket('x');
        gm.rejoinRoom(x, roomId, 'not-a-token');
        assert.ok(x.events.some(([e]) => e === 'rejoin_failed'));
        gm.rejoinRoom(x, 'NOPE00', 'whatever');
        assert.equal(x.events.filter(([e]) => e === 'rejoin_failed').length, 2);
    });
});

describe('Rematch starting player', () => {
    it('gives the loser the first move', () => {
        const gm = new GameManager(makeIo(), { graceMs: 0 });
        const { a, b, roomId, room } = setupRoom(gm);
        const g = room.game;
        g.makeMove(0, { index: 0 }); g.makeMove(1, { index: 3 });
        g.makeMove(0, { index: 1 }); g.makeMove(1, { index: 4 });
        g.makeMove(0, { index: 2 });
        assert.equal(g.winner, 0);
        gm.handleRestart(a, { roomId });
        gm.handleRestart(b, { roomId });
        assert.equal(room.game.activePlayerIndex, 1);
    });

    it('alternates after a draw', () => {
        const gm = new GameManager(makeIo(), { graceMs: 0 });
        const { a, b, roomId, room } = setupRoom(gm);
        room.game.isGameOver = true;
        room.game.winner = 'draw';
        gm.handleRestart(a, { roomId });
        gm.handleRestart(b, { roomId });
        assert.equal(room.game.activePlayerIndex, 1);
    });

    it('ignores play_again while a game is still running', () => {
        const gm = new GameManager(makeIo(), { graceMs: 0 });
        const { a, b, roomId, room } = setupRoom(gm);
        const g = room.game;
        gm.handleRestart(a, { roomId });
        gm.handleRestart(b, { roomId });
        assert.equal(room.game, g, 'no restart mid-game');
    });
});

describe('Word Chain', () => {
    const WordChain = require('../games/wordchain');

    it('does not start its clock until start() is called, and pauses on disconnect', () => {
        const game = new WordChain('r', [fakeSocket('a'), fakeSocket('b')], 0, makeIo());
        assert.equal(game.timer, null);
        assert.equal(game.getState().started, false);
        game.start();
        assert.notEqual(game.timer, null);
        game.pause();
        assert.equal(game.timer, null);
        assert.equal(game.getState().paused, true);
        assert.equal(game.makeMove(0, { word: 'apple' }).valid, false);
        game.resume();
        assert.notEqual(game.timer, null);
        game.cleanup();
    });

    it('accepts 3-letter words and gives a clear message for unknown words', () => {
        const game = new WordChain('r', [fakeSocket('a'), fakeSocket('b')], 0, makeIo());
        assert.equal(game.makeMove(0, { word: 'cat' }).valid, true);
        const r = game.makeMove(1, { word: 'tyrannosaur' });
        assert.equal(r.valid, false);
        assert.match(r.message, /word list|too long/i);
        game.cleanup();
    });

    it('never leaves the opponent with a letter that has no words', () => {
        const game = new WordChain('r', [fakeSocket('a'), fakeSocket('b')], 0, makeIo());
        // Burn every word starting with 'x', then end a word with 'x'.
        game.gameState.usedWords = new Set(['xenon', 'xerox', 'xylem']);
        assert.equal(game.makeMove(0, { word: 'flex' }).valid, true);
        assert.equal(game.gameState.lastLetter, null, 'chain resets when the letter is exhausted');
        assert.match(game.gameState.message, /any word allowed/i);
        assert.equal(game.makeMove(1, { word: 'apple' }).valid, true);
        game.cleanup();
    });

    it('starts the timer only once both players are ready', () => {
        const gm = new GameManager(makeIo(), { graceMs: 0, readyFallbackMs: 10000 });
        const { a, b, roomId, room } = setupRoom(gm, 'wordchain');
        assert.equal(room.game.started, false);
        gm.handleReady(a, { roomId });
        assert.equal(room.game.started, false);
        gm.handleReady(b, { roomId });
        assert.equal(room.game.started, true);
        room.game.cleanup();
        clearTimeout(room.readyFallback);
    });
});
