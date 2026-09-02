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

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('create_room', (data = {}) => {
        gameManager.createRoom(socket, data.gameType, data.playerName);
    });
    socket.on('join_room', (data = {}) => {
        gameManager.joinRoom(socket, data.roomId, data.playerName);
    });

    socket.on('make_move', (data) => gameManager.handleMove(socket, data));
    socket.on('play_again', (data) => gameManager.handleRestart(socket, data));

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        gameManager.handleDisconnect(socket);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
