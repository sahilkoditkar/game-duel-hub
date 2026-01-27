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

        // Start game if 2 players
        this.startGame(roomId);
    }

    startGame(roomId) {
        const room = this.rooms.get(roomId);
        if (!room || room.players.length !== 2) return;

        console.log(`Starting game in room ${roomId} (Type: ${room.type})`);

        let GameClass;
        if (room.type === 'tictactoe') {
            GameClass = require('./games/tictactoe');
        } else if (room.type === 'dotsandboxes') {
            GameClass = require('./games/dotsandboxes');
        } else if (room.type === 'bingo') {
            GameClass = require('./games/bingo');
        } else {
            console.error('Unknown game type:', room.type);
            return;
        }

        room.game = new GameClass(roomId, room.players);

        // Broadcast initial state
        // We also send it in game_start to avoid race conditions with checking/loading scripts
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

        // Also emit standard state event for good measure (or existing listeners)
        room.game.emitState();
        // Emit current score on start too
        this.io.to(roomId).emit('score_update', room.scores);
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

        // For simplicity, if one person clicks play again, we restart for both immediately.
        console.log(`Restarting game in room ${roomId}`);
        this.startGame(roomId);
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
