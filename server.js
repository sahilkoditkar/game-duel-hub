const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const GameManager = require('./game-manager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// GameManager instance
const gameManager = new GameManager(io);

// A throwing handler must never take the whole process (and every room) down.
function safe(socket, eventName, handler) {
    socket.on(eventName, (...args) => {
        try {
            handler(...args);
        } catch (err) {
            console.error(`Error handling '${eventName}' from ${socket.id}:`, err);
            try {
                socket.emit('error', 'Something went wrong, please try again');
            } catch (_) { /* socket already gone */ }
        }
    });
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    safe(socket, 'create_room', (data = {}) => {
        if (!data || typeof data !== 'object') data = {};
        gameManager.createRoom(socket, data.gameType, data.playerName);
    });
    safe(socket, 'join_room', (data = {}) => {
        if (!data || typeof data !== 'object') data = {};
        gameManager.joinRoom(socket, data.roomId, data.playerName);
    });
    safe(socket, 'rejoin_room', (data = {}) => {
        if (!data || typeof data !== 'object') data = {};
        gameManager.rejoinRoom(socket, data.roomId, data.token);
    });

    safe(socket, 'player_ready', (data) => gameManager.handleReady(socket, data));
    safe(socket, 'make_move', (data) => gameManager.handleMove(socket, data));
    safe(socket, 'play_again', (data) => gameManager.handleRestart(socket, data));

    safe(socket, 'disconnect', () => {
        console.log('User disconnected:', socket.id);
        gameManager.handleDisconnect(socket);
    });
});

// Last line of defence: log instead of dying on anything a timer callback throws.
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception (server kept running):', err);
});
process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection (server kept running):', err);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
