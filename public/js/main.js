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
    checkers: 'initCheckers',
    rps: 'initRps'
};

const GAME_LABELS = {
    tictactoe: 'Tic-Tac-Toe',
    dotsandboxes: 'Dots and Boxes',
    bingo: 'Bingo',
    battleship: 'Battleship',
    hangman: 'Hangman',
    mastermind: 'Mastermind',
    connectfour: 'Connect Four',
    nim: 'Nim',
    memory: 'Memory Match',
    wordchain: 'Word Chain',
    reversi: 'Reversi',
    checkers: 'Checkers',
    rps: 'Rock Paper Scissors'
};

// UI Elements
const lobbyView = document.getElementById('lobby-view');
const gameContainer = document.getElementById('game-container');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const roomIdInput = document.getElementById('room-id-input');
const gameSelect = document.getElementById('game-select');
const playerNameInput = document.getElementById('player-name-input');
const currentRoomIdSpan = document.getElementById('current-room-id');
const copyRoomBtn = document.getElementById('copy-room-btn');
const shareRoomBtn = document.getElementById('share-room-btn');
const playerBadge = document.getElementById('player-badge');
const toastEl = document.getElementById('toast');
const modal = document.getElementById('game-over-modal');
const modalMessage = document.getElementById('modal-message');
const modalPlayAgain = document.getElementById('modal-play-again');
const modalLeave = document.getElementById('modal-leave');
const modalHint = document.getElementById('modal-hint');
const gameArea = document.getElementById('game-area');

let currentGameType = null;
let currentRoomId = null;
let myPlayerIndex = 0;
let playerNames = ['Player 1', 'Player 2'];
let modalTimeout = null;
let lastGameOverKey = null;
let toastTimeout = null;

function getPlayerName() {
    const stored = localStorage.getItem('gamehub_name') || '';
    return (playerNameInput.value || stored || '').trim().slice(0, 16);
}

if (playerNameInput) {
    const saved = localStorage.getItem('gamehub_name');
    if (saved) playerNameInput.value = saved;
    playerNameInput.addEventListener('change', () => {
        localStorage.setItem('gamehub_name', getPlayerName());
    });
}

createBtn.addEventListener('click', () => {
    localStorage.setItem('gamehub_name', getPlayerName());
    socket.emit('create_room', { gameType: gameSelect.value, playerName: getPlayerName() });
});

joinBtn.addEventListener('click', tryJoin);

roomIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryJoin();
});

roomIdInput.addEventListener('input', () => {
    roomIdInput.value = roomIdInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

function tryJoin() {
    const roomId = roomIdInput.value.trim().toUpperCase();
    if (roomId.length !== 6) {
        showToast('Enter a 6-character room code');
        return;
    }
    localStorage.setItem('gamehub_name', getPlayerName());
    socket.emit('join_room', { roomId, playerName: getPlayerName() });
}

copyRoomBtn.addEventListener('click', async () => {
    if (!currentRoomId) return;
    try {
        await navigator.clipboard.writeText(currentRoomId);
        showToast('Room code copied');
    } catch {
        showToast(currentRoomId);
    }
});

shareRoomBtn.addEventListener('click', async () => {
    if (!currentRoomId) return;
    const url = `${location.origin}/?room=${currentRoomId}`;
    try {
        await navigator.clipboard.writeText(url);
        showToast('Invite link copied');
    } catch {
        showToast(url);
    }
});

modalLeave.addEventListener('click', () => {
    location.href = '/';
});

modalPlayAgain.addEventListener('click', () => {
    if (modalTimeout) { clearTimeout(modalTimeout); modalTimeout = null; }
    socket.emit('play_again', { roomId: currentRoomId });
    modal.classList.add('hidden');
    if (modalHint) modalHint.textContent = '';
    showStatus('Waiting for opponent to play again...');
});

socket.on('connect', () => {
    const params = new URLSearchParams(location.search);
    const roomFromUrl = (params.get('room') || '').trim().toUpperCase();
    if (roomFromUrl.length === 6 && !currentRoomId) {
        roomIdInput.value = roomFromUrl;
        tryJoin();
    }
});

socket.on('room_created', (data) => {
    currentRoomId = data.roomId;
    currentGameType = data.gameType;
    myPlayerIndex = data.playerIndex || 0;
    playerNames = data.names || playerNames;
    enterGameView(currentRoomId);
    updatePlayerBadge();
    showStatus('Waiting for opponent — share the room code!');
});

socket.on('room_joined', (data) => {
    currentRoomId = data.roomId;
    currentGameType = data.gameType;
    myPlayerIndex = data.playerIndex || 1;
    playerNames = data.names || playerNames;
    enterGameView(currentRoomId);
    updatePlayerBadge();
    showStatus('Joined room! Waiting for game start...');
});

socket.on('player_joined', (data) => {
    if (data.names) playerNames = data.names;
    updatePlayerBadge();
    showStatus('Player joined!');
});

socket.on('player_left', () => {
    if (modalTimeout) { clearTimeout(modalTimeout); modalTimeout = null; }
    modalMessage.textContent = 'Opponent left the room';
    if (modalHint) modalHint.textContent = 'The match has ended.';
    modalPlayAgain.classList.add('hidden');
    modal.classList.remove('hidden');
});

socket.on('score_update', (scores) => {
    document.getElementById('s1').textContent = scores[0];
    document.getElementById('s2').textContent = scores[1];
});

socket.on('play_again_status', (data) => {
    const ready = data.ready || [false, false];
    if (data.names) playerNames = data.names;
    const mine = ready[myPlayerIndex];
    const theirs = ready[1 - myPlayerIndex];
    if (mine && !theirs) {
        showStatus('Waiting for opponent to play again...');
    } else if (!mine && theirs) {
        modalHint.textContent = 'Opponent wants a rematch';
        modalMessage.textContent = 'Opponent is ready — play again?';
        modal.classList.remove('hidden');
        modalPlayAgain.classList.remove('hidden');
    }
});

socket.on('game_start', (data) => {
    console.log('Game starting! Player Index:', data.playerIndex);
    lastGameOverKey = null;
    myPlayerIndex = data.playerIndex;
    currentGameType = data.gameType;
    if (data.names) playerNames = data.names;
    updatePlayerBadge();
    modalPlayAgain.classList.remove('hidden');
    if (modalHint) modalHint.textContent = '';
    showStatus('Game Starting...');
    if (modalTimeout) { clearTimeout(modalTimeout); modalTimeout = null; }
    modal.classList.add('hidden');

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
    showToast(msg);
});

function enterGameView(roomId) {
    lobbyView.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    currentRoomIdSpan.textContent = roomId;
    document.body.classList.add('in-game');
    const title = GAME_LABELS[currentGameType];
    if (title) {
        document.getElementById('current-game-name').textContent = title;
    }
}

function updatePlayerBadge() {
    const me = playerNames[myPlayerIndex] || `Player ${myPlayerIndex + 1}`;
    const opp = playerNames[1 - myPlayerIndex] || `Player ${2 - myPlayerIndex}`;
    playerBadge.textContent = `You: ${me}`;
    document.getElementById('n1').textContent = playerNames[0] || 'P1';
    document.getElementById('n2').textContent = playerNames[1] || 'P2';
}

function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.add('hidden');
        toastTimeout = null;
    }, 2800);
}
window.showToast = showToast;

function showStatus(msg) {
    const statusEl = document.createElement('div');
    statusEl.textContent = msg;
    statusEl.className = 'status-msg';

    const isOver = msg.includes('Won') || msg.includes('Lost') || msg.includes('Draw') || msg.includes('BINGO');
    if (isOver) {
        if (lastGameOverKey === msg) return;
        lastGameOverKey = msg;
        modalMessage.textContent = msg;
        modalPlayAgain.classList.remove('hidden');
        if (modalHint) {
            modalHint.textContent = 'Both players must tap Play Again to start a rematch.';
        }
        if (modalTimeout) clearTimeout(modalTimeout);
        modalTimeout = setTimeout(() => {
            modal.classList.remove('hidden');
            modalTimeout = null;
        }, 2000);
    }
}
window.showStatus = showStatus;

function loadGameScript(gameType, data) {
    const existing = document.querySelector(`script[data-game="${gameType}"]`);
    if (existing) {
        const initFn = GAME_INIT[gameType];
        if (initFn && typeof window[initFn] === 'function') {
            window[initFn](socket, gameArea, currentRoomId, data.playerIndex, data.initialState);
        }
        return;
    }
    const script = document.createElement('script');
    script.src = `js/games/${gameType}-client.js`;
    script.dataset.game = gameType;
    script.onload = () => {
        const initFn = GAME_INIT[gameType];
        if (initFn && typeof window[initFn] === 'function') {
            window[initFn](socket, gameArea, currentRoomId, data.playerIndex, data.initialState);
        }
    };
    script.onerror = () => {
        gameArea.innerHTML = '<p>Could not load this game.</p>';
        showToast('Failed to load game script');
    };
    document.body.appendChild(script);
}
