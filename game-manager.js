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
    checkers: { module: './games/checkers' }
};

class GameManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map(); // roomId -> { players: [socket], game: GameInstance, type: 'tictactoe' }
    }

    createRoom(socket, gameType) {
        const roomId = uuidv4().substring(0, 6).toUpperCase(); // Short code
        this.rooms.set(roomId, {
            players: [socket],
            game: null,
            type: gameType,
            status: 'waiting',
            scores: [0, 0] // [p1, p2]
        });
        socket.join(roomId);
        socket.emit('room_created', { roomId, gameType });
        console.log(`Room ${roomId} created by ${socket.id} for ${gameType}`);
    }

    joinRoom(socket, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        if (room.players.length >= 2) {
            socket.emit('error', 'Room is full');
            return;
        }

        room.players.push(socket);
        socket.join(roomId);
        room.status = 'ready';

        // Notify both players
        this.io.to(roomId).emit('player_joined', { playerId: socket.id });

        // Notify the joiner specifically to switch UI
        socket.emit('room_joined', { roomId, gameType: room.type });

        console.log(`User ${socket.id} joined room ${roomId}`);

        // Start game
        this.startGame(roomId, 0);
    }

    startGame(roomId, startingPlayerIndex = 0) {
        const room = this.rooms.get(roomId);
        if (!room || room.players.length !== 2) return;

        console.log(`Starting game in room ${roomId} (Type: ${room.type})`);

        // Store who started this game
        room.lastStarterIndex = startingPlayerIndex;

        const entry = GAME_REGISTRY[room.type];
        if (!entry) {
            console.error('Unknown game type:', room.type);
            return;
        }

        const GameClass = require(entry.module);

        // Special constructor handling
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

        // Broadcast initial state
        const initialState = room.game.getState();

        // Notify players of start and assignment
        room.players.forEach((p, index) => {
            p.emit('game_start', {
                roomId,
                playerIndex: index,
                gameType: room.type,
                initialState
            });
        });

        setTimeout(() => {
            room.game.emitState(); // Ensure state is emitted after start
            this.io.to(roomId).emit('score_update', room.scores);
        }, 0);
    }

    handleMove(socket, data) {
        const { roomId, move } = data;
        const room = this.rooms.get(roomId);

        if (!room || !room.game) return;

        // Find player index
        const playerIndex = room.players.indexOf(socket);
        if (playerIndex === -1) return;

        const result = room.game.makeMove(playerIndex, move);
        if (!result.valid) {
            socket.emit('invalid_move', result.message);
            return;
        }

        if (room.game.isGameOver) {
            if (room.game.winner !== 'draw') {
                room.scores[room.game.winner]++;
            }
            this.io.to(roomId).emit('score_update', room.scores);
        }
    }

    handleRestart(socket, data) {
        const { roomId } = data;
        const room = this.rooms.get(roomId);
        if (!room) return;

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
        // Find room where socket is present
        for (const [roomId, room] of this.rooms) {
            const index = room.players.indexOf(socket);
            if (index !== -1) {
                room.players.splice(index, 1);
                this.io.to(roomId).emit('player_left', { playerId: socket.id });

                // Clean up timer for wordchain
                if (room.game && room.game.cleanup) {
                    room.game.cleanup();
                }

                // End game if running
                if (room.game) {
                    this.rooms.delete(roomId);
                } else if (room.players.length === 0) {
                    this.rooms.delete(roomId);
                }
                break;
            }
        }
    }
}

module.exports = GameManager;
