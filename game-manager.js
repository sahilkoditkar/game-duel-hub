const { v4: uuidv4 } = require('uuid');

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

        // Default TicTacToe
        this.startGame(roomId, 0);
    }

    startGame(roomId, startingPlayerIndex = 0) {
        const room = this.rooms.get(roomId);
        if (!room || room.players.length !== 2) return;

        console.log(`Starting game in room ${roomId} (Type: ${room.type})`);

        // Store who started this game
        room.lastStarterIndex = startingPlayerIndex;

        let GameClass;
        if (room.type === 'tictactoe') {
            GameClass = require('./games/tictactoe');
        } else if (room.type === 'dotsandboxes') {
            GameClass = require('./games/dotsandboxes');
        } else if (room.type === 'bingo') {
            GameClass = require('./games/bingo');
        } else if (room.type === 'battleship') {
            GameClass = require('./games/battleship');
        } else if (room.type === 'hangman') {
            GameClass = require('./games/hangman');
            // Ensure usedWords exists
            if (!room.usedWords) room.usedWords = [];
        } else if (room.type === 'mastermind') {
            GameClass = require('./games/mastermind');
        } else {
            console.error('Unknown game type:', room.type);
            return;
        }

        // Special Constructor handling
        if (room.type === 'hangman') {
            room.game = new GameClass(roomId, room.players, startingPlayerIndex, room.usedWords);
            if (room.game.word) room.usedWords.push(room.game.word);
        } else if (room.type === 'mastermind') {
            // Pass lastMakerIndex if exists
            room.game = new GameClass(roomId, room.players, startingPlayerIndex, room.lastMakerIndex);
            // Store new maker index for next time
            room.lastMakerIndex = room.game.makerIndex;
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

        // Logic:
        // If Hangman -> Alternating start
        // Else -> Winner starts (or swap on draw)

        if (room.type === 'hangman') {
            nextStarter = 1 - (room.lastStarterIndex || 0);
        } else {
            if (room.game && room.game.isGameOver) {
                if (room.game.winner !== 'draw' && room.game.winner !== null) {
                    nextStarter = room.game.winner;
                } else {
                    // Draw: Swap from who started LAST time
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
