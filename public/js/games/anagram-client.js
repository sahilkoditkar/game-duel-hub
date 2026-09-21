function initAnagram(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('anagram-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'anagram-styles';
    style.textContent = `
        .ang-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 480px;
            margin: 0 auto;
        }
        .ang-info { font-size: 0.85rem; color: #888; text-align: center; }
        .ang-timer {
            font-size: clamp(2rem, 8vw, 3rem);
            font-weight: bold;
            color: var(--secondary-color);
            line-height: 1;
        }
        .ang-timer.urgent { color: #ef4444; animation: ang-pulse 0.5s infinite alternate; }
        @keyframes ang-pulse { from { opacity: 1; } to { opacity: 0.5; } }
        .ang-scores {
            display: flex;
            gap: 24px;
            font-size: 1rem;
            font-weight: bold;
        }
        .ang-scores .me { color: var(--secondary-color); }
        .ang-scores .opp { color: var(--primary-color); }
        .ang-scores small { font-weight: normal; color: #888; }
        .ang-letters {
            display: grid;
            grid-template-columns: repeat(9, 1fr);
            gap: 4px;
            width: 100%;
            max-width: 420px;
            user-select: none;
            -webkit-user-select: none;
        }
        .ang-tile {
            aspect-ratio: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #2c2c2c;
            border: 2px solid #444;
            border-radius: 6px;
            color: #fff;
            font-weight: bold;
            font-size: clamp(1rem, 4.5vw, 1.5rem);
            text-transform: uppercase;
            cursor: pointer;
            touch-action: manipulation;
            transition: transform 0.1s, opacity 0.15s;
        }
        .ang-tile:active { transform: scale(0.92); }
        .ang-tile.used { opacity: 0.3; }
        .ang-letters.locked .ang-tile { cursor: not-allowed; opacity: 0.5; }
        .ang-input-row { display: flex; gap: 8px; width: 100%; }
        .ang-input {
            flex: 1;
            min-width: 0;
            padding: 12px;
            background: #222;
            border: 2px solid #444;
            border-radius: 8px;
            color: #fff;
            font-size: 1.2rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            outline: none;
        }
        .ang-input:focus { border-color: var(--primary-color); }
        .ang-input:disabled { opacity: 0.4; }
        .ang-btn {
            padding: 12px 14px;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            touch-action: manipulation;
        }
        .ang-btn:active { transform: scale(0.95); }
        .ang-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ang-btn.submit { background: var(--primary-color); color: #000; }
        .ang-btn.clear { background: #444; color: #fff; }
        .ang-message { color: #aaa; font-size: 0.9rem; min-height: 1.2em; text-align: center; }
        .ang-lists { display: flex; gap: 10px; width: 100%; }
        .ang-list {
            flex: 1;
            min-width: 0;
            background: #222;
            border-radius: 8px;
            padding: 8px;
            max-height: clamp(120px, 28vh, 220px);
            overflow-y: auto;
        }
        .ang-list h4 { font-size: 0.8rem; color: #888; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
        .ang-list.me h4 { color: var(--secondary-color); }
        .ang-list.opp h4 { color: var(--primary-color); }
        .ang-word {
            display: flex;
            justify-content: space-between;
            font-size: 0.95rem;
            padding: 3px 6px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .ang-word span:last-child { color: #888; font-size: 0.8rem; }
        .ang-word.mine { background: rgba(3, 218, 198, 0.15); }
        .ang-word.theirs { background: rgba(187, 134, 252, 0.15); }
        .ang-empty { color: #666; font-size: 0.85rem; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="ang-wrap">
            <div class="ang-info">Make words (3+ letters) from the 9 tiles. Each letter of a word scores a point. Most points in 60s wins.</div>
            <div class="ang-timer" id="ang-timer">60</div>
            <div class="ang-scores">
                <span class="me">You <span id="ang-my-score">0</span> <small>(<span id="ang-my-count">0</span> words)</small></span>
                <span class="opp">Opp <span id="ang-opp-score">0</span> <small>(<span id="ang-opp-count">0</span> words)</small></span>
            </div>
            <div class="ang-letters" id="ang-letters"></div>
            <div class="ang-input-row">
                <input type="text" class="ang-input" id="ang-input" placeholder="Type or tap letters" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="9">
                <button class="ang-btn clear" id="ang-clear" type="button">Clear</button>
                <button class="ang-btn submit" id="ang-submit" type="button">Add</button>
            </div>
            <div class="ang-message" id="ang-message"></div>
            <div class="ang-lists">
                <div class="ang-list me"><h4>Your words</h4><div id="ang-my-words"></div></div>
                <div class="ang-list opp" id="ang-opp-list"><h4>Opponent</h4><div id="ang-opp-words"></div></div>
            </div>
        </div>
    `;

    const statusEl = document.getElementById('game-status');
    const timerEl = document.getElementById('ang-timer');
    const myScoreEl = document.getElementById('ang-my-score');
    const myCountEl = document.getElementById('ang-my-count');
    const oppScoreEl = document.getElementById('ang-opp-score');
    const oppCountEl = document.getElementById('ang-opp-count');
    const lettersEl = document.getElementById('ang-letters');
    const inputEl = document.getElementById('ang-input');
    const clearEl = document.getElementById('ang-clear');
    const submitEl = document.getElementById('ang-submit');
    const messageEl = document.getElementById('ang-message');
    const myWordsEl = document.getElementById('ang-my-words');
    const oppWordsEl = document.getElementById('ang-opp-words');

    const myIdx = playerIndex;
    let lastState = initialState || null;
    let tileEls = [];
    let builtLetters = '';
    let lastMessage = null;

    function canPlay() {
        if (!canAct(lastState, myIdx)) return false;
        if (!lastState) return true;
        return lastState.started === true && !lastState.paused;
    }

    function buildTiles(letters) {
        lettersEl.innerHTML = '';
        tileEls = [];
        for (const ch of letters) {
            const tile = document.createElement('div');
            tile.className = 'ang-tile';
            tile.textContent = ch;
            tile.addEventListener('click', () => {
                if (!canPlay()) return;
                if (inputEl.value.length >= letters.length) return;
                inputEl.value += ch;
                markUsedTiles();
            });
            lettersEl.appendChild(tile);
            tileEls.push(tile);
        }
        builtLetters = letters;
    }

    // Dim tiles that the current input has already consumed (respecting duplicates).
    function markUsedTiles() {
        const remaining = inputEl.value.toLowerCase().split('');
        tileEls.forEach(tile => {
            const ch = tile.textContent;
            const at = remaining.indexOf(ch);
            if (at !== -1) {
                remaining.splice(at, 1);
                tile.classList.add('used');
            } else {
                tile.classList.remove('used');
            }
        });
    }

    function submitWord() {
        if (!canPlay()) return;
        const word = inputEl.value.trim().toLowerCase();
        if (word.length < 3) {
            if (typeof showToast === 'function') showToast('At least 3 letters');
            return;
        }
        socket.emit('make_move', { roomId, move: { word } });
        inputEl.value = '';
        markUsedTiles();
        inputEl.focus();
    }

    submitEl.addEventListener('click', submitWord);
    clearEl.addEventListener('click', () => {
        inputEl.value = '';
        markUsedTiles();
        inputEl.focus();
    });
    inputEl.addEventListener('input', () => {
        inputEl.value = inputEl.value.replace(/[^a-zA-Z]/g, '');
        markUsedTiles();
    });
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitWord(); }
    });

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => {
        if (typeof showToast === 'function') showToast(msg);
    });

    if (initialState) render(initialState);

    function renderWordList(el, words, cls) {
        el.innerHTML = '';
        if (!words.length) {
            const empty = document.createElement('div');
            empty.className = 'ang-empty';
            empty.textContent = 'None yet';
            el.appendChild(empty);
            return;
        }
        words.forEach(w => {
            const row = document.createElement('div');
            row.className = 'ang-word ' + cls;
            const wordSpan = document.createElement('span');
            wordSpan.textContent = w.word;
            const ptsSpan = document.createElement('span');
            ptsSpan.textContent = '+' + w.points;
            row.appendChild(wordSpan);
            row.appendChild(ptsSpan);
            el.appendChild(row);
        });
    }

    function render(state) {
        lastState = state;
        const letters = state.letters || '';
        if (letters !== builtLetters) buildTiles(letters);

        // Timer
        timerEl.textContent = state.paused ? '⏸' : (state.started === false ? '•••' : state.timeLeft);
        timerEl.className = 'ang-timer' + (state.started && !state.paused && !state.isGameOver && state.timeLeft <= 10 ? ' urgent' : '');

        // Scores
        const myWords = state.myWords || [];
        myScoreEl.textContent = state.myScore;
        myCountEl.textContent = myWords.length;
        oppScoreEl.textContent = state.oppScore;
        oppCountEl.textContent = state.oppWordCount;

        // Lists
        renderWordList(myWordsEl, myWords, 'mine');
        if (state.isGameOver && Array.isArray(state.allWords)) {
            renderWordList(oppWordsEl, state.allWords[1 - myIdx] || [], 'theirs');
        } else {
            oppWordsEl.innerHTML = '';
            const hidden = document.createElement('div');
            hidden.className = 'ang-empty';
            hidden.textContent = `${state.oppWordCount} word${state.oppWordCount === 1 ? '' : 's'} found (revealed at the end)`;
            oppWordsEl.appendChild(hidden);
        }

        // Input availability
        const active = canPlay();
        inputEl.disabled = !active;
        submitEl.disabled = !active;
        clearEl.disabled = !active;
        lettersEl.classList.toggle('locked', !active);
        if (active) inputEl.focus();

        // Message line
        let msg = '';
        if (!state.isGameOver) {
            if (state.paused) msg = 'Paused - waiting for reconnection';
            else if (state.started === false) msg = 'Clock starts when both are ready';
        }
        if (msg !== lastMessage) {
            lastMessage = msg;
            messageEl.textContent = msg;
        }

        // Status
        if (state.isGameOver) {
            const result = state.winner === 'draw' ? "It's a Draw!" : (state.winner === myIdx ? 'You Won!' : 'You Lost!');
            statusEl.textContent = result;
            showStatus(result);
        } else if (state.paused) {
            statusEl.textContent = 'Paused';
        } else if (state.started === false) {
            statusEl.textContent = 'Get ready...';
        } else {
            statusEl.textContent = 'Find words - go!';
        }
    }
}
