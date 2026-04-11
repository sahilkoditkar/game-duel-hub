const socket = io();

// Game init function registry
const GAME_INIT = {
    tictactoe: 'initTicTacToe',
    dotsandboxes: 'initDotsAndBoxes',
    bingo: 'initBingo',
    battleship: 'initBattleship',
    hangman: 'initHangman',
    mastermind: 'initMastermind',
    connectfour: 'initConnectFour',
    nim: 'initNim',
    memory: 'initMemory',
    wordchain: 'initWordChain',
    reversi: 'initReversi',
    checkers: 'initCheckers'
};

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

    const initFn = GAME_INIT[data.gameType];
    if (!initFn) {
        gameArea.innerHTML = '<p>Unknown game type</p>';
        return;
    }

    if (typeof window[initFn] === 'function') {
        window[initFn](socket, gameArea, currentRoomId, data.playerIndex, data.initialState);
    } else {
        gameArea.innerHTML = '<p>Loading game...</p>';
        loadGameScript(data.gameType, data);
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
    document.body.classList.add('in-game');
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
        const initFn = GAME_INIT[gameType];
        if (initFn && typeof window[initFn] === 'function') {
            window[initFn](socket, gameArea, currentRoomId, data.playerIndex, data.initialState);
        }
    };
    document.body.appendChild(script);
}
