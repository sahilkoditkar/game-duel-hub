const { v4: uuidv4 } = require('uuid');

// Game registry - add new games here
const GAME_REGISTRY = {
    tictactoe: { module: './games/tictactoe' },
    dotsandboxes: { module: './games/dotsandboxes' },
    bingo: { module: './games/bingo' },
    battleship: { module: './games/battleship' },
    hangman: { module: './games/hangman', special: 'hangman' },
    mastermind: { module: './games/mastermind', special: 'mastermind' },
    connectfour: { module: './games/connectfour' },
    nim: { module: './games/nim' },
    memory: { module: './games/memory' },
    wordchain: { module: './games/wordchain', special: 'wordchain' },
    reversi: { module: './games/reversi' },
    checkers: { module: './games/checkers' },
    rps: { module: './games/rps' }
};

// How long a disconnected player keeps their seat before the room gives up on them.
const RECONNECT_GRACE_MS = 60 * 1000;
// If a client never reports ready (old cached script, etc.), start timed games anyway.
const READY_FALLBACK_MS = 5000;

function sanitizeName(name, fallback) {
    if (typeof name !== 'string') return fallback;
    const trimmed = name.trim().slice(0, 16);
    return trimmed || fallback;
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

class GameManager {
    constructor(io, options = {}) {
        this.io = io;
        this.rooms = new Map(); // roomId -> room
        this.socketRoom = new Map(); // socket.id -> roomId
        this.graceMs = options.graceMs !== undefined ? options.graceMs : RECONNECT_GRACE_MS;
        this.readyFallbackMs = options.readyFallbackMs !== undefined ? options.readyFallbackMs : READY_FALLBACK_MS;
    }

    findRoomIdForSocket(socket) {
        return this.socketRoom.get(socket.id) || null;
    }

    // A connected socket that starts/joins another room leaves its old one immediately (no grace).
    leaveCurrentRoom(socket) {
        const existing = this.findRoomIdForSocket(socket);
        if (!existing) return;
        const room = this.rooms.get(existing);
        if (!room) {
            this.socketRoom.delete(socket.id);
            return;
        }
        const index = room.players.indexOf(socket);
        if (index === -1) {
            this.socketRoom.delete(socket.id);
            return;
        }
        this.removePlayer(existing, index);
    }

    createRoom(socket, gameType, playerName) {
        if (!GAME_REGISTRY[gameType]) {
            socket.emit('error', 'Unknown game type');
            return;
        }

        this.leaveCurrentRoom(socket);

        let roomId;
        do {
            roomId = uuidv4().substring(0, 6).toUpperCase();
        } while (this.rooms.has(roomId));

        const name = sanitizeName(playerName, 'Player 1');
        const token = uuidv4();

        this.rooms.set(roomId, {
            players: [socket],
            tokens: [token],
            names: [name, 'Player 2'],
            disconnected: [false, false],
            graceTimers: [null, null],
            ready: [false, false],
            game: null,
            type: gameType,
            status: 'waiting',
            scores: [0, 0],
            playAgain: [false, false],
            lastStarterIndex: null,
            lastMakerIndex: null,
            usedWords: []
        });
        this.socketRoom.set(socket.id, roomId);
        socket.join(roomId);
        socket.emit('room_created', { roomId, gameType, playerIndex: 0, names: [name, 'Player 2'], token });
        console.log(`Room ${roomId} created by ${socket.id} for ${gameType}`);
    }

    joinRoom(socket, roomId, playerName) {
        if (typeof roomId !== 'string') {
            socket.emit('error', 'Room not found');
            return;
        }
        roomId = roomId.trim().toUpperCase();

        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        const existing = this.findRoomIdForSocket(socket);
        if (existing === roomId) {
            socket.emit('error', 'You are already in this room');
            return;
        }

        if (room.players.length >= 2) {
            const someoneReconnecting = room.disconnected.some(Boolean);
            socket.emit('error', someoneReconnecting
                ? 'Room is full (a player is reconnecting)'
                : 'Room is full');
            return;
        }

        this.leaveCurrentRoom(socket);

        const token = uuidv4();
        room.names[1] = sanitizeName(playerName, 'Player 2');
        room.players.push(socket);
        room.tokens[1] = token;
        room.disconnected[1] = false;
        room.scores[1] = 0;
        this.socketRoom.set(socket.id, roomId);
        socket.join(roomId);
        room.status = 'ready';
        room.playAgain = [false, false];

        this.io.to(roomId).emit('player_joined', {
            playerId: socket.id,
            names: room.names
        });

        socket.emit('room_joined', {
            roomId,
            gameType: room.type,
            playerIndex: 1,
            names: room.names,
            token
        });

        console.log(`User ${socket.id} joined room ${roomId}`);

        this.startGame(roomId, 0);
    }

    // A client that lost its connection comes back with the token it was given.
    rejoinRoom(socket, roomId, token) {
        if (typeof roomId !== 'string' || typeof token !== 'string') {
            socket.emit('rejoin_failed', 'Your previous game has ended');
            return;
        }
        roomId = roomId.trim().toUpperCase();
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit('rejoin_failed', 'Your previous game has ended');
            return;
        }
        const index = room.tokens.indexOf(token);
        if (index === -1 || !room.players[index]) {
            socket.emit('rejoin_failed', 'Your previous game has ended');
            return;
        }

        const old = room.players[index];
        if (old !== socket) {
            // Take over the seat (also covers a duplicated tab reusing the same token).
            this.socketRoom.delete(old.id);
            if (typeof old.leave === 'function') old.leave(roomId);
            room.players[index] = socket; // in place: the game holds this same array
        }

        this.clearGrace(room, index);
        room.disconnected[index] = false;
        this.socketRoom.set(socket.id, roomId);
        socket.join(roomId);

        socket.emit('room_rejoined', {
            roomId,
            gameType: room.type,
            playerIndex: index,
            names: room.names,
            scores: room.scores,
            token,
            status: room.status
        });

        if (room.game) {
            socket.emit('game_start', {
                roomId,
                playerIndex: index,
                gameType: room.type,
                names: room.names,
                initialState: room.game.getStateForPlayer(index),
                resumed: true
            });
            socket.emit('score_update', room.scores);
            socket.emit('play_again_status', { ready: room.playAgain, names: room.names });
            if (!room.disconnected.some(Boolean) && typeof room.game.resume === 'function') {
                room.game.resume();
            }
        }

        room.players.forEach((p, i) => {
            if (i !== index) p.emit('opponent_reconnected', { playerIndex: index, names: room.names });
        });

        console.log(`User ${socket.id} rejoined room ${roomId} as player ${index}`);
    }

    startGame(roomId, startingPlayerIndex = 0) {
        const room = this.rooms.get(roomId);
        if (!room || room.players.length !== 2) return;

        console.log(`Starting game in room ${roomId} (Type: ${room.type})`);

        if (room.game && typeof room.game.cleanup === 'function') {
            room.game.cleanup();
        }
        if (room.readyFallback) {
            clearTimeout(room.readyFallback);
            room.readyFallback = null;
        }

        room.lastStarterIndex = startingPlayerIndex;
        room.playAgain = [false, false];
        room.ready = [false, false];
        room.status = 'playing';

        const entry = GAME_REGISTRY[room.type];
        if (!entry) {
            console.error('Unknown game type:', room.type);
            return;
        }

        const GameClass = require(entry.module);

        if (entry.special === 'hangman') {
            if (!room.usedWords) room.usedWords = [];
            room.game = new GameClass(roomId, room.players, startingPlayerIndex, room.usedWords);
            if (room.game.word) room.usedWords.push(room.game.word);
        } else if (entry.special === 'mastermind') {
            room.game = new GameClass(roomId, room.players, startingPlayerIndex, room.lastMakerIndex);
            room.lastMakerIndex = room.game.makerIndex;
        } else if (entry.special === 'wordchain') {
            room.game = new GameClass(roomId, room.players, startingPlayerIndex, this.io);
        } else {
            room.game = new GameClass(roomId, room.players, startingPlayerIndex);
        }

        room.game.onGameOver = () => {
            if (room.game.winner !== 'draw' && room.game.winner !== null) {
                room.scores[room.game.winner]++;
            }
            this.io.to(roomId).emit('score_update', room.scores);
        };

        room.players.forEach((p, index) => {
            p.emit('game_start', {
                roomId,
                playerIndex: index,
                gameType: room.type,
                names: room.names,
                initialState: room.game.getStateForPlayer(index)
            });
        });

        const game = room.game;
        setTimeout(() => {
            if (room.game !== game) return;
            game.emitState();
            this.io.to(roomId).emit('score_update', room.scores);
        }, 0);

        // Timed games wait for both clients to report ready, with a fallback so nobody hangs.
        if (typeof game.start === 'function') {
            room.readyFallback = setTimeout(() => {
                room.readyFallback = null;
                if (room.game === game) game.start();
            }, this.readyFallbackMs);
        }
    }

    handleReady(socket, data) {
        if (!isPlainObject(data)) return;
        const room = this.rooms.get(data.roomId);
        if (!room || !room.game) return;
        const playerIndex = room.players.indexOf(socket);
        if (playerIndex === -1) return;

        room.ready[playerIndex] = true;
        if (room.ready[0] && room.ready[1] && typeof room.game.start === 'function') {
            if (room.readyFallback) {
                clearTimeout(room.readyFallback);
                room.readyFallback = null;
            }
            room.game.start();
        }
    }

    handleMove(socket, data) {
        if (!isPlainObject(data)) {
            socket.emit('invalid_move', 'Invalid move');
            return;
        }
        const { roomId, move } = data;
        const room = this.rooms.get(roomId);

        if (!room || !room.game) return;

        const playerIndex = room.players.indexOf(socket);
        if (playerIndex === -1) return;

        if (!isPlainObject(move)) {
            socket.emit('invalid_move', 'Invalid move');
            return;
        }

        if (room.disconnected.some(Boolean)) {
            socket.emit('invalid_move', 'Opponent is reconnecting, hold on...');
            return;
        }

        let result;
        try {
            result = room.game.makeMove(playerIndex, move);
        } catch (err) {
            console.error(`Move error in room ${roomId} (${room.type}):`, err);
            result = { valid: false, message: 'Invalid move' };
        }
        if (!result || !result.valid) {
            socket.emit('invalid_move', (result && result.message) || 'Invalid move');
        }
    }

    handleRestart(socket, data) {
        if (!isPlainObject(data)) return;
        const { roomId } = data;
        const room = this.rooms.get(roomId);
        if (!room || room.players.length !== 2) return;

        const playerIndex = room.players.indexOf(socket);
        if (playerIndex === -1) return;

        if (!room.game || !room.game.isGameOver) return;

        if (!room.playAgain) room.playAgain = [false, false];
        room.playAgain[playerIndex] = true;

        this.io.to(roomId).emit('play_again_status', {
            ready: room.playAgain,
            names: room.names
        });

        if (!(room.playAgain[0] && room.playAgain[1])) {
            return;
        }

        console.log(`Restarting game in room ${roomId}`);
        this.startGame(roomId, this.nextStarter(room));
    }

    // The loser of the last game moves first; on a draw the start alternates.
    nextStarter(room) {
        const last = room.lastStarterIndex === null || room.lastStarterIndex === undefined
            ? 0
            : room.lastStarterIndex;
        const game = room.game;
        if (game && game.isGameOver && game.winner !== 'draw' && game.winner !== null && room.type !== 'hangman') {
            return 1 - game.winner;
        }
        return 1 - last;
    }

    clearGrace(room, index) {
        if (room.graceTimers && room.graceTimers[index]) {
            clearTimeout(room.graceTimers[index]);
            room.graceTimers[index] = null;
        }
    }

    // Network drop: keep the seat for a while so the player can come back.
    handleDisconnect(socket) {
        const mappedRoomId = this.socketRoom.get(socket.id);
        this.socketRoom.delete(socket.id);

        const roomsToScan = mappedRoomId ? [[mappedRoomId, this.rooms.get(mappedRoomId)]] : [...this.rooms];

        for (const [roomId, room] of roomsToScan) {
            if (!room) continue;
            const index = room.players.indexOf(socket);
            if (index === -1) continue;

            if (this.graceMs <= 0) {
                this.removePlayer(roomId, index);
                return;
            }

            room.disconnected[index] = true;
            if (room.game && typeof room.game.pause === 'function') {
                room.game.pause();
            }

            room.players.forEach((p, i) => {
                if (i !== index) {
                    p.emit('opponent_disconnected', {
                        playerIndex: index,
                        names: room.names,
                        graceSeconds: Math.round(this.graceMs / 1000)
                    });
                }
            });

            this.clearGrace(room, index);
            room.graceTimers[index] = setTimeout(() => {
                room.graceTimers[index] = null;
                // Only remove if this very socket still holds the seat (a rejoin replaces it).
                if (room.players[index] === socket) {
                    this.removePlayer(roomId, index);
                }
            }, this.graceMs);
            return;
        }
    }

    // Permanently free a seat. The remaining player (if any) becomes player 0 and keeps
    // their own name and score; the room becomes joinable again with the same code.
    removePlayer(roomId, index) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        const socket = room.players[index];
        if (!socket) return;

        this.clearGrace(room, index);
        this.socketRoom.delete(socket.id);
        if (typeof socket.leave === 'function') socket.leave(roomId);

        room.players.splice(index, 1); // in place: the game holds this same array
        room.tokens.splice(index, 1);
        room.names.splice(index, 1);
        room.scores.splice(index, 1);
        const hasRemaining = room.players.length > 0;
        room.names = [hasRemaining ? room.names[0] : 'Player 1', 'Player 2'];
        room.scores = [hasRemaining ? room.scores[0] : 0, 0];
        room.disconnected = [false, false];
        room.graceTimers = [null, null];
        room.ready = [false, false];

        if (room.game && typeof room.game.cleanup === 'function') {
            room.game.cleanup();
        }
        if (room.readyFallback) {
            clearTimeout(room.readyFallback);
            room.readyFallback = null;
        }
        room.game = null;
        room.status = 'waiting';
        room.playAgain = [false, false];
        room.lastStarterIndex = null;
        room.lastMakerIndex = null; // seat indexes changed; role alternation restarts

        room.players.forEach((p, i) => {
            p.emit('player_left', {
                playerId: socket.id,
                playerIndex: index,
                yourIndex: i,
                names: room.names,
                scores: room.scores
            });
        });

        if (room.players.length === 0) {
            this.rooms.delete(roomId);
        }
        console.log(`Player ${socket.id} removed from room ${roomId}`);
    }
}

module.exports = GameManager;
module.exports.GAME_REGISTRY = GAME_REGISTRY;
module.exports.RECONNECT_GRACE_MS = RECONNECT_GRACE_MS;
