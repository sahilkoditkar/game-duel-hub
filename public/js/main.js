const socket = io();

// UI Elements
const lobbyView = document.getElementById('lobby-view');
const gameContainer = document.getElementById('game-container');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const roomIdInput = document.getElementById('room-id-input');
const gameSelect = document.getElementById('game-select');
const currentRoomIdSpan = document.getElementById('current-room-id');
// Modal Elements
const modal = document.getElementById('game-over-modal');
const modalMessage = document.getElementById('modal-message');
const modalPlayAgain = document.getElementById('modal-play-again');
const modalLeave = document.getElementById('modal-leave');

const gameArea = document.getElementById('game-area');

let currentGameType = null;
let currentRoomId = null;
let isGameInitialized = false;

// Event Listeners
createBtn.addEventListener('click', () => {
    const gameType = gameSelect.value;
    socket.emit('create_room', { gameType });
});

joinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.toUpperCase();
    if (roomId.length === 6) {
        socket.emit('join_room', { roomId });
    } else {
        alert('Invalid Room ID');
    }
});

// Modal Actions
modalLeave.addEventListener('click', () => {
    location.reload();
});

modalPlayAgain.addEventListener('click', () => {
    socket.emit('play_again', { roomId: currentRoomId });
    modal.classList.add('hidden');
    showStatus('Waiting for restart...');
});

// Socket Events
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('room_created', (data) => {
    currentRoomId = data.roomId;
    enterGameView(currentRoomId);
    showStatus('Waiting for opponent...');
});

socket.on('room_joined', (data) => {
    currentRoomId = data.roomId;
    enterGameView(currentRoomId);
    showStatus('Joined room! Waiting for game start...');
});

socket.on('player_joined', (data) => {
    showStatus('Player joined!');
});

socket.on('score_update', (scores) => {
    document.getElementById('s1').textContent = scores[0];
    document.getElementById('s2').textContent = scores[1];
});

socket.on('game_start', (data) => {
    console.log('Game starting! Player Index:', data.playerIndex);
    showStatus('Game Starting...');
    modal.classList.add('hidden'); // Ensure modal is closed

    // Load game specific script or init game
    if (data.gameType === 'dotsandboxes') {
        if (typeof initDotsAndBoxes === 'function') {
            initDotsAndBoxes(socket, gameArea, currentRoomId, data.playerIndex, data.initialState);
        } else {
            loadGameScript('dotsandboxes', data);
        }
    } else if (data.gameType === 'bingo') {
        if (typeof initBingo === 'function') {
            initBingo(socket, gameArea, currentRoomId, data.playerIndex, data.initialState);
        } else {
            loadGameScript('bingo', data);
        }
    } else {
        // Default TicTacToe
        if (typeof initTicTacToe === 'function') {
            initTicTacToe(socket, gameArea, currentRoomId, data.playerIndex, data.initialState);
        } else {
            gameArea.innerHTML = '<p>Loading game...</p>';
            loadGameScript('tictactoe', data);
        }
    }
});

socket.on('error', (msg) => {
    alert(msg);
});

// Helpers
function enterGameView(roomId) {
    lobbyView.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    currentRoomIdSpan.textContent = roomId;
}

function showStatus(msg) {
    const statusEl = document.createElement('div');
    statusEl.textContent = msg;
    statusEl.className = 'status-msg';

    // Check if game over message to trigger modal
    if (msg.includes('Won') || msg.includes('Lost') || msg.includes('Draw')) {
        modalMessage.textContent = msg;
        modal.classList.remove('hidden');
    }
}

function loadGameScript(gameType, data) {
    const script = document.createElement('script');
    script.src = `js/games/${gameType}-client.js`;
    script.onload = () => {
        if (gameType === 'dotsandboxes' && typeof initDotsAndBoxes === 'function') {
            initDotsAndBoxes(socket, gameArea, currentRoomId, data.playerIndex, data.initialState);
        } else if (gameType === 'bingo' && typeof initBingo === 'function') {
            initBingo(socket, gameArea, currentRoomId, data.playerIndex, data.initialState);
        } else if (typeof initTicTacToe === 'function') {
            initTicTacToe(socket, gameArea, currentRoomId, data.playerIndex, data.initialState);
        }
    };
    document.body.appendChild(script);
}
