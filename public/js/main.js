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

const SESSION_KEY = 'gamehub_session';

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
const modalWait = document.getElementById('modal-wait');
const modalHint = document.getElementById('modal-hint');
const gameArea = document.getElementById('game-area');
const hubStatus = document.getElementById('hub-status');
const connBanner = document.getElementById('conn-banner');

let currentGameType = null;
let currentRoomId = null;
let myPlayerIndex = 0;
let playerNames = ['Player 1', 'Player 2'];
let modalTimeout = null;
let lastGameOverKey = null;
let toastTimeout = null;
let hasConnectedOnce = false;

// ---- Session persistence (per tab) so a dropped connection can resume the game ----
function saveSession(roomId, token) {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, token }));
    } catch { /* storage unavailable: reconnect simply won't resume */ }
}

function loadSession() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.roomId === 'string' && typeof parsed.token === 'string') return parsed;
    } catch { /* ignore */ }
    return null;
}

function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function getPlayerName() {
    let stored = '';
    try { stored = localStorage.getItem('gamehub_name') || ''; } catch { /* ignore */ }
    return (playerNameInput.value || stored || '').trim().slice(0, 16);
}

function rememberName() {
    try { localStorage.setItem('gamehub_name', getPlayerName()); } catch { /* ignore */ }
}

if (playerNameInput) {
    try {
        const saved = localStorage.getItem('gamehub_name');
        if (saved) playerNameInput.value = saved;
    } catch { /* ignore */ }
    playerNameInput.addEventListener('change', rememberName);
}

createBtn.addEventListener('click', () => {
    rememberName();
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
    rememberName();
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
    clearSession();
    location.href = '/';
});

if (modalWait) {
    modalWait.addEventListener('click', () => {
        modal.classList.add('hidden');
        showStatus('Waiting for a new opponent — share the room code!');
    });
}

modalPlayAgain.addEventListener('click', () => {
    if (modalTimeout) { clearTimeout(modalTimeout); modalTimeout = null; }
    socket.emit('play_again', { roomId: currentRoomId });
    modal.classList.add('hidden');
    if (modalHint) modalHint.textContent = '';
    showStatus('Waiting for opponent to play again...');
});

// ---- Connection lifecycle ----
socket.on('connect', () => {
    const wasReconnect = hasConnectedOnce;
    hasConnectedOnce = true;
    hideBanner();

    const session = loadSession();
    if (session) {
        // Either a reconnect mid-game or a page reload in the same tab: ask for our seat back.
        socket.emit('rejoin_room', session);
        if (wasReconnect) showToast('Reconnected, resuming game...');
        return;
    }

    const params = new URLSearchParams(location.search);
    const roomFromUrl = (params.get('room') || '').trim().toUpperCase();
    if (roomFromUrl.length === 6 && !currentRoomId) {
        roomIdInput.value = roomFromUrl;
        tryJoin();
    }
});

socket.on('disconnect', () => {
    if (!currentRoomId) return;
    showBanner('Connection lost. Reconnecting...', 'warn');
});

socket.io.on('reconnect_attempt', () => {
    if (currentRoomId) showBanner('Connection lost. Reconnecting...', 'warn');
});

socket.on('room_created', (data) => {
    currentRoomId = data.roomId;
    currentGameType = data.gameType;
    myPlayerIndex = data.playerIndex || 0;
    playerNames = data.names || playerNames;
    if (data.token) saveSession(currentRoomId, data.token);
    enterGameView(currentRoomId);
    updatePlayerBadge();
    showStatus('Waiting for opponent — share the room code!');
});

socket.on('room_joined', (data) => {
    currentRoomId = data.roomId;
    currentGameType = data.gameType;
    myPlayerIndex = data.playerIndex || 1;
    playerNames = data.names || playerNames;
    if (data.token) saveSession(currentRoomId, data.token);
    enterGameView(currentRoomId);
    updatePlayerBadge();
    showStatus('Joined room! Waiting for game start...');
});

socket.on('room_rejoined', (data) => {
    currentRoomId = data.roomId;
    currentGameType = data.gameType;
    myPlayerIndex = data.playerIndex;
    playerNames = data.names || playerNames;
    if (data.token) saveSession(currentRoomId, data.token);
    enterGameView(currentRoomId);
    updatePlayerBadge();
    if (Array.isArray(data.scores)) updateScores(data.scores);
    hideBanner();
    if (data.status === 'waiting') {
        showStatus('Waiting for opponent — share the room code!');
    }
});

socket.on('rejoin_failed', (msg) => {
    clearSession();
    if (currentRoomId) {
        // We were in a game that no longer exists on the server.
        hideBanner();
        modalMessage.textContent = 'Your game has ended';
        if (modalHint) modalHint.textContent = msg || 'The room is no longer available.';
        modalPlayAgain.classList.add('hidden');
        if (modalWait) modalWait.classList.add('hidden');
        modal.classList.remove('hidden');
    }
    // Fresh page load with a stale session: just stay in the lobby and honour any invite link.
    const params = new URLSearchParams(location.search);
    const roomFromUrl = (params.get('room') || '').trim().toUpperCase();
    if (!currentRoomId && roomFromUrl.length === 6) {
        roomIdInput.value = roomFromUrl;
        tryJoin();
    }
});

socket.on('opponent_disconnected', (data) => {
    if (data && data.names) playerNames = data.names;
    const secs = data && data.graceSeconds ? data.graceSeconds : 60;
    showBanner(`Opponent lost connection. Holding their seat for up to ${secs}s...`, 'warn');
});

socket.on('opponent_reconnected', (data) => {
    if (data && data.names) playerNames = data.names;
    hideBanner();
    showToast('Opponent reconnected');
});

socket.on('player_joined', (data) => {
    if (data.names) playerNames = data.names;
    updatePlayerBadge();
    hideStatus();
});

socket.on('player_left', (data) => {
    if (modalTimeout) { clearTimeout(modalTimeout); modalTimeout = null; }
    hideBanner();
    if (data) {
        if (typeof data.yourIndex === 'number') myPlayerIndex = data.yourIndex;
        if (data.names) playerNames = data.names;
        if (Array.isArray(data.scores)) updateScores(data.scores);
    }
    updatePlayerBadge();
    modalMessage.textContent = 'Opponent left the room';
    if (modalHint) modalHint.textContent = 'You can keep this room open and invite someone else with the same code.';
    modalPlayAgain.classList.add('hidden');
    if (modalWait) modalWait.classList.remove('hidden');
    modal.classList.remove('hidden');
});

socket.on('score_update', (scores) => updateScores(scores));

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
        if (modalWait) modalWait.classList.add('hidden');
    }
});

socket.on('game_start', (data) => {
    console.log('Game starting! Player Index:', data.playerIndex);
    lastGameOverKey = null;
    myPlayerIndex = data.playerIndex;
    currentGameType = data.gameType;
    if (data.names) playerNames = data.names;
    if (data.roomId) currentRoomId = data.roomId;
    enterGameView(currentRoomId);
    updatePlayerBadge();
    modalPlayAgain.classList.remove('hidden');
    if (modalWait) modalWait.classList.add('hidden');
    if (modalHint) modalHint.textContent = '';
    hideStatus();
    hideBanner();
    if (modalTimeout) { clearTimeout(modalTimeout); modalTimeout = null; }
    modal.classList.add('hidden');

    const initFn = GAME_INIT[data.gameType];
    if (!initFn) {
        gameArea.innerHTML = '<p>Unknown game type</p>';
        return;
    }

    if (typeof window[initFn] === 'function') {
        runGameInit(initFn, data);
    } else {
        gameArea.innerHTML = '<p>Loading game...</p>';
        loadGameScript(data.gameType, data);
    }
});

socket.on('error', (msg) => {
    showToast(msg);
});

function runGameInit(initFn, data) {
    window[initFn](socket, gameArea, currentRoomId, data.playerIndex, data.initialState);
    // Tell the server our board is on screen (timed games start their clock on this).
    socket.emit('player_ready', { roomId: currentRoomId });
}

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
    playerBadge.textContent = `You: ${me}`;
    document.getElementById('n1').textContent = playerNames[0] || 'P1';
    document.getElementById('n2').textContent = playerNames[1] || 'P2';
}

function updateScores(scores) {
    if (!Array.isArray(scores)) return;
    document.getElementById('s1').textContent = scores[0];
    document.getElementById('s2').textContent = scores[1];
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

// Shared tap guard for game clients: ignore taps that the server would reject anyway
// (not your turn, game over) instead of round-tripping and showing an error.
function canAct(state, myIdx) {
    if (!state) return true; // no state yet: let the server decide
    if (state.isGameOver) return false;
    const active = state.activePlayerIndex;
    if (active !== null && active !== undefined && active !== myIdx) return false;
    return true;
}
window.canAct = canAct;

function showBanner(msg, kind) {
    if (!connBanner) return;
    connBanner.textContent = msg;
    connBanner.className = 'conn-banner' + (kind ? ` ${kind}` : '');
}

function hideBanner() {
    if (!connBanner) return;
    connBanner.className = 'conn-banner hidden';
}

// Persistent status line above the board. Game-over messages go to the modal instead.
function showStatus(msg) {
    const isOver = msg.includes('Won') || msg.includes('Lost') || msg.includes('Draw') || msg.includes('BINGO');
    if (isOver) {
        if (lastGameOverKey === msg) return;
        lastGameOverKey = msg;
        modalMessage.textContent = msg;
        modalPlayAgain.classList.remove('hidden');
        if (modalWait) modalWait.classList.add('hidden');
        if (modalHint) {
            modalHint.textContent = 'Both players must tap Play Again to start a rematch.';
        }
        if (modalTimeout) clearTimeout(modalTimeout);
        modalTimeout = setTimeout(() => {
            modal.classList.remove('hidden');
            modalTimeout = null;
        }, 2000);
        return;
    }

    if (hubStatus) {
        hubStatus.textContent = msg;
        hubStatus.classList.remove('hidden');
    }
}
window.showStatus = showStatus;

function hideStatus() {
    if (hubStatus) {
        hubStatus.textContent = '';
        hubStatus.classList.add('hidden');
    }
}

function loadGameScript(gameType, data) {
    const initFn = GAME_INIT[gameType];
    const existing = document.querySelector(`script[data-game="${gameType}"]`);
    if (existing) {
        if (initFn && typeof window[initFn] === 'function') {
            runGameInit(initFn, data);
        }
        return;
    }
    const script = document.createElement('script');
    script.src = `js/games/${gameType}-client.js`;
    script.dataset.game = gameType;
    script.onload = () => {
        if (initFn && typeof window[initFn] === 'function') {
            runGameInit(initFn, data);
        }
    };
    script.onerror = () => {
        gameArea.innerHTML = '<p>Could not load this game.</p>';
        showToast('Failed to load game script');
    };
    document.body.appendChild(script);
}
