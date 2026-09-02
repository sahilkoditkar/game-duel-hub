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

function sanitizeName(name, fallback) {
    if (typeof name !== 'string') return fallback;
    const trimmed = name.trim().slice(0, 16);
    return trimmed || fallback;
}

class GameManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomId -> room
        this.socketRoom = new Map(); // socket.id -> roomId
    }

    findRoomIdForSocket(socket) {
        return this.socketRoom.get(socket.id) || null;
    }

    leaveCurrentRoom(socket) {
        const existing = this.findRoomIdForSocket(socket);
        if (existing) {
            this.handleDisconnect(socket);
        }
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

        this.rooms.set(roomId, {
            players: [socket],
            names: [name, 'Player 2'],
            game: null,
            type: gameType,
            status: 'waiting',
            scores: [0, 0],
            playAgain: [false, false]
        });
        this.socketRoom.set(socket.id, roomId);
        socket.join(roomId);
        socket.emit('room_created', { roomId, gameType, playerIndex: 0, names: [name, 'Player 2'] });
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

        if (room.players.length >= 2) {
            socket.emit('error', 'Room is full');
            return;
        }

        const existing = this.findRoomIdForSocket(socket);
        if (existing === roomId) {
            socket.emit('error', 'You are already in this room');
            return;
        }

        this.leaveCurrentRoom(socket);

        room.names[1] = sanitizeName(playerName, 'Player 2');
        room.players.push(socket);
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
            names: room.names
        });

        console.log(`User ${socket.id} joined room ${roomId}`);

        this.startGame(roomId, 0);
    }

    startGame(roomId, startingPlayerIndex = 0) {
        const room = this.rooms.get(roomId);
        if (!room || room.players.length !== 2) return;

        console.log(`Starting game in room ${roomId} (Type: ${room.type})`);

        if (room.game && typeof room.game.cleanup === 'function') {
            room.game.cleanup();
        }

        room.lastStarterIndex = startingPlayerIndex;
        room.playAgain = [false, false];
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

        setTimeout(() => {
            if (!room.game) return;
            room.game.emitState();
            this.io.to(roomId).emit('score_update', room.scores);
        }, 0);
    }

    handleMove(socket, data) {
        const { roomId, move } = data;
        const room = this.rooms.get(roomId);

        if (!room || !room.game) return;

        const playerIndex = room.players.indexOf(socket);
        if (playerIndex === -1) return;

        const result = room.game.makeMove(playerIndex, move);
        if (!result || !result.valid) {
            socket.emit('invalid_move', (result && result.message) || 'Invalid move');
        }
    }

    handleRestart(socket, data) {
        const { roomId } = data;
        const room = this.rooms.get(roomId);
        if (!room || room.players.length !== 2) return;

        const playerIndex = room.players.indexOf(socket);
        if (playerIndex === -1) return;

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

        let nextStarter = 0;

        if (room.type === 'hangman') {
            nextStarter = 1 - (room.lastStarterIndex || 0);
        } else {
            if (room.game && room.game.isGameOver) {
                if (room.game.winner !== 'draw' && room.game.winner !== null) {
                    nextStarter = room.game.winner;
                } else {
                    nextStarter = 1 - (room.lastStarterIndex || 0);
                }
            } else {
                nextStarter = 1 - (room.lastStarterIndex || 0);
            }
        }

        this.startGame(roomId, nextStarter);
    }

    handleDisconnect(socket) {
        const mappedRoomId = this.socketRoom.get(socket.id);
        this.socketRoom.delete(socket.id);

        const roomsToScan = mappedRoomId ? [[mappedRoomId, this.rooms.get(mappedRoomId)]] : [...this.rooms];

        for (const [roomId, room] of roomsToScan) {
            if (!room) continue;
            const index = room.players.indexOf(socket);
            if (index === -1) continue;

            room.players.splice(index, 1);
            socket.leave(roomId);

            if (room.game && typeof room.game.cleanup === 'function') {
                room.game.cleanup();
            }
            room.game = null;
            room.status = 'abandoned';
            room.playAgain = [false, false];

            this.io.to(roomId).emit('player_left', {
                playerId: socket.id,
                playerIndex: index,
                names: room.names
            });

            if (room.players.length === 0) {
                this.rooms.delete(roomId);
            }
            break;
        }
    }
}

module.exports = GameManager;
module.exports.GAME_REGISTRY = GAME_REGISTRY;
