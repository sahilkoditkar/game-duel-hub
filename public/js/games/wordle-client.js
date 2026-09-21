function initWordle(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('wordle-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'wordle-styles';
    style.textContent = `
        .wdl-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 480px;
            margin: 0 auto;
            user-select: none;
            -webkit-user-select: none;
        }
        .wdl-info { font-size: 0.85rem; color: #888; text-align: center; }
        .wdl-boards {
            display: flex;
            gap: 14px;
            align-items: flex-start;
            justify-content: center;
            width: 100%;
        }
        .wdl-col { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .wdl-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.04em; }
        .wdl-label.me { color: var(--secondary-color); }
        .wdl-label.opp { color: var(--primary-color); }
        .wdl-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 5px;
        }
        .wdl-grid.mine { width: clamp(200px, 60vw, 300px); }
        .wdl-grid.theirs { width: clamp(70px, 20vw, 100px); gap: 3px; }
        .wdl-tile {
            aspect-ratio: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #3a3a3a;
            border-radius: 4px;
            background: #222;
            color: #fff;
            font-weight: bold;
            font-size: clamp(1rem, 5vw, 1.6rem);
            text-transform: uppercase;
        }
        .wdl-grid.theirs .wdl-tile { border-width: 1px; border-radius: 2px; }
        .wdl-tile.filled { border-color: #666; }
        .wdl-tile.f2 { background: #10b981; border-color: #10b981; color: #fff; }
        .wdl-tile.f1 { background: #facc15; border-color: #facc15; color: #111; }
        .wdl-tile.f0 { background: #333; border-color: #333; color: #ddd; }
        .wdl-tile.current { border-color: var(--secondary-color); }
        .wdl-tile.shake { animation: wdl-shake 0.3s; }
        @keyframes wdl-shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-4px); }
            75% { transform: translateX(4px); }
        }
        .wdl-meta {
            display: flex;
            gap: 20px;
            font-size: 0.9rem;
            color: #ccc;
        }
        .wdl-secret {
            min-height: 1.4em;
            font-size: 1rem;
            color: #ddd;
        }
        .wdl-secret strong { color: #10b981; text-transform: uppercase; letter-spacing: 0.1em; }
        .wdl-keyboard {
            display: flex;
            flex-direction: column;
            gap: 6px;
            width: 100%;
            max-width: 480px;
        }
        .wdl-krow { display: flex; gap: 4px; justify-content: center; }
        .wdl-key {
            flex: 1;
            min-width: 0;
            max-width: 44px;
            height: clamp(42px, 12vw, 56px);
            border: none;
            border-radius: 6px;
            background: #555;
            color: #fff;
            font-size: clamp(0.8rem, 3.5vw, 1rem);
            font-weight: bold;
            text-transform: uppercase;
            cursor: pointer;
            touch-action: manipulation;
            padding: 0;
        }
        .wdl-key.wide { flex: 1.6; max-width: 72px; font-size: 0.7rem; }
        .wdl-key:active { transform: scale(0.94); }
        .wdl-key.k2 { background: #10b981; }
        .wdl-key.k1 { background: #facc15; color: #111; }
        .wdl-key.k0 { background: #2a2a2a; color: #888; }
        .wdl-keyboard.locked .wdl-key { opacity: 0.4; cursor: not-allowed; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="wdl-wrap">
            <div class="wdl-info">Same secret word for both. First to guess it wins. 6 tries each.</div>
            <div class="wdl-boards">
                <div class="wdl-col">
                    <div class="wdl-label me">You</div>
                    <div class="wdl-grid mine" id="wdl-mine"></div>
                </div>
                <div class="wdl-col">
                    <div class="wdl-label opp">Opponent</div>
                    <div class="wdl-grid theirs" id="wdl-theirs"></div>
                    <div class="wdl-label" id="wdl-opp-count">0 / 6</div>
                </div>
            </div>
            <div class="wdl-meta">
                <span>Your guesses: <span id="wdl-my-count">0</span> / 6</span>
            </div>
            <div class="wdl-secret" id="wdl-secret"></div>
            <div class="wdl-keyboard" id="wdl-keyboard"></div>
        </div>
    `;

    const statusEl = document.getElementById('game-status');
    const mineEl = document.getElementById('wdl-mine');
    const theirsEl = document.getElementById('wdl-theirs');
    const myCountEl = document.getElementById('wdl-my-count');
    const oppCountEl = document.getElementById('wdl-opp-count');
    const secretEl = document.getElementById('wdl-secret');
    const keyboardEl = document.getElementById('wdl-keyboard');

    const myIdx = playerIndex;
    const WORD_LENGTH = 5;
    let lastState = initialState || null;
    let current = '';
    let lastGuessCount = -1;

    // Build the tile grids once; render() only updates classes/text.
    const myTiles = [];
    const oppTiles = [];
    function buildGrid(el, rows, list) {
        el.innerHTML = '';
        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < WORD_LENGTH; c++) {
                const tile = document.createElement('div');
                tile.className = 'wdl-tile';
                el.appendChild(tile);
                row.push(tile);
            }
            list.push(row);
        }
    }
    const maxGuesses = (initialState && initialState.maxGuesses) || 6;
    buildGrid(mineEl, maxGuesses, myTiles);
    buildGrid(theirsEl, maxGuesses, oppTiles);

    // Keyboard
    const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    const keyEls = {};
    KEY_ROWS.forEach((row, i) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'wdl-krow';
        if (i === 2) rowEl.appendChild(makeKey('Enter', 'enter', true));
        for (const ch of row) rowEl.appendChild(makeKey(ch, ch, false));
        if (i === 2) rowEl.appendChild(makeKey('⌫', 'backspace', true));
        keyboardEl.appendChild(rowEl);
    });
    function makeKey(label, value, wide) {
        const btn = document.createElement('button');
        btn.className = 'wdl-key' + (wide ? ' wide' : '');
        btn.textContent = label;
        btn.type = 'button';
        btn.addEventListener('click', () => handleKey(value));
        if (!wide) keyEls[value] = btn;
        return btn;
    }

    function iCanGuess() {
        if (!canAct(lastState, myIdx)) return false;
        if (!lastState) return true;
        if (lastState.solved && lastState.solved[myIdx]) return false;
        if (lastState.out && lastState.out[myIdx]) return false;
        return lastState.myGuessCount < lastState.maxGuesses;
    }

    function handleKey(key) {
        if (!iCanGuess()) return;
        if (key === 'enter') {
            if (current.length !== WORD_LENGTH) {
                shakeCurrentRow();
                if (typeof showToast === 'function') showToast('Word must be 5 letters');
                return;
            }
            socket.emit('make_move', { roomId, move: { word: current } });
            return;
        }
        if (key === 'backspace') {
            current = current.slice(0, -1);
            renderCurrentRow();
            return;
        }
        if (/^[a-z]$/.test(key) && current.length < WORD_LENGTH) {
            current += key;
            renderCurrentRow();
        }
    }

    // Physical keyboard: one document listener at a time across re-inits.
    if (window._wordleKeyHandler) {
        document.removeEventListener('keydown', window._wordleKeyHandler);
    }
    const keyHandler = (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (!document.body.contains(keyboardEl)) {
            document.removeEventListener('keydown', keyHandler);
            if (window._wordleKeyHandler === keyHandler) window._wordleKeyHandler = null;
            return;
        }
        if (e.key === 'Enter') { e.preventDefault(); handleKey('enter'); }
        else if (e.key === 'Backspace') { e.preventDefault(); handleKey('backspace'); }
        else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toLowerCase());
    };
    window._wordleKeyHandler = keyHandler;
    document.addEventListener('keydown', keyHandler);

    function shakeCurrentRow() {
        const rowIdx = lastState ? lastState.myGuessCount : 0;
        const row = myTiles[rowIdx];
        if (!row) return;
        row.forEach(t => {
            t.classList.remove('shake');
            void t.offsetWidth;
            t.classList.add('shake');
        });
    }

    function renderCurrentRow() {
        if (!lastState) return;
        const rowIdx = lastState.myGuessCount;
        const row = myTiles[rowIdx];
        if (!row) return;
        const active = iCanGuess();
        for (let c = 0; c < WORD_LENGTH; c++) {
            const ch = current[c] || '';
            row[c].textContent = ch;
            row[c].className = 'wdl-tile' + (ch ? ' filled' : '') + (active ? ' current' : '');
        }
    }

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => {
        shakeCurrentRow();
        if (typeof showToast === 'function') showToast(msg);
    });

    if (initialState) render(initialState);

    function render(state) {
        lastState = state;
        const myGuesses = state.myGuesses || [];
        const oppFeedback = state.opponentFeedback || [];

        if (state.myGuessCount !== lastGuessCount) {
            lastGuessCount = state.myGuessCount;
            current = '';
        }

        // My grid
        const best = {};
        for (let r = 0; r < myTiles.length; r++) {
            const guess = myGuesses[r];
            for (let c = 0; c < WORD_LENGTH; c++) {
                const tile = myTiles[r][c];
                if (guess) {
                    const ch = guess.word[c];
                    const f = guess.feedback[c];
                    tile.textContent = ch;
                    tile.className = 'wdl-tile filled f' + f;
                    if (best[ch] === undefined || f > best[ch]) best[ch] = f;
                } else {
                    tile.textContent = '';
                    tile.className = 'wdl-tile';
                }
            }
        }
        renderCurrentRow();

        // Opponent grid: colors only
        for (let r = 0; r < oppTiles.length; r++) {
            const fb = oppFeedback[r];
            for (let c = 0; c < WORD_LENGTH; c++) {
                oppTiles[r][c].className = 'wdl-tile' + (fb ? ' f' + fb[c] : '');
            }
        }

        myCountEl.textContent = state.myGuessCount;
        oppCountEl.textContent = `${state.oppGuessCount} / ${state.maxGuesses}`;

        // Keyboard coloring
        Object.keys(keyEls).forEach(ch => {
            keyEls[ch].className = 'wdl-key' + (best[ch] !== undefined ? ' k' + best[ch] : '');
        });
        keyboardEl.classList.toggle('locked', !iCanGuess());

        // Secret reveal
        secretEl.innerHTML = '';
        if (state.isGameOver && state.secret) {
            secretEl.appendChild(document.createTextNode('The word was '));
            const strong = document.createElement('strong');
            strong.textContent = state.secret;
            secretEl.appendChild(strong);
        }

        // Status
        const oppIdx = 1 - myIdx;
        if (state.isGameOver) {
            const msg = state.winner === 'draw' ? "It's a Draw!" : (state.winner === myIdx ? 'You Won!' : 'You Lost!');
            statusEl.textContent = msg;
            showStatus(msg);
        } else if (state.out && state.out[myIdx]) {
            statusEl.textContent = 'Out of guesses - waiting for opponent';
        } else if (state.out && state.out[oppIdx]) {
            statusEl.textContent = 'Opponent is out - keep guessing!';
        } else {
            statusEl.textContent = `Guess the word (${state.myGuessCount}/${state.maxGuesses} used)`;
        }
    }
}
