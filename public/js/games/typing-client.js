function initTyping(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('typing-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'typing-styles';
    style.textContent = `
        .typ-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 520px;
            margin: 0 auto;
        }
        .typ-info { font-size: 0.85rem; color: #888; text-align: center; }
        .typ-timer {
            font-size: clamp(1.8rem, 7vw, 2.6rem);
            font-weight: bold;
            color: var(--secondary-color);
            line-height: 1;
        }
        .typ-timer.urgent { color: #ef4444; animation: typ-pulse 0.5s infinite alternate; }
        @keyframes typ-pulse { from { opacity: 1; } to { opacity: 0.5; } }
        .typ-sentence {
            width: 100%;
            background: #222;
            border-radius: 8px;
            padding: 14px;
            font-size: clamp(1.05rem, 4.5vw, 1.35rem);
            line-height: 1.6;
            font-family: 'Courier New', Courier, monospace;
            word-break: break-word;
            user-select: none;
            -webkit-user-select: none;
        }
        .typ-sentence .ok { color: #10b981; }
        .typ-sentence .err { color: #ef4444; background: rgba(239, 68, 68, 0.2); text-decoration: underline; }
        .typ-sentence .rest { color: #888; }
        .typ-sentence .cursor { border-left: 2px solid var(--secondary-color); margin-left: -1px; }
        .typ-input {
            width: 100%;
            min-height: 84px;
            padding: 12px;
            background: #222;
            border: 2px solid #444;
            border-radius: 8px;
            color: #fff;
            font-size: 1.1rem;
            font-family: 'Courier New', Courier, monospace;
            resize: none;
            outline: none;
        }
        .typ-input:focus { border-color: var(--primary-color); }
        .typ-input.error { border-color: #ef4444; }
        .typ-input:disabled { opacity: 0.4; }
        .typ-bars { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .typ-bar-row { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
        .typ-bar-label { width: 3.2em; font-weight: bold; }
        .typ-bar-row.me .typ-bar-label { color: var(--secondary-color); }
        .typ-bar-row.opp .typ-bar-label { color: var(--primary-color); }
        .typ-bar { flex: 1; height: 12px; background: #333; border-radius: 6px; overflow: hidden; }
        .typ-bar-fill { height: 100%; width: 0; transition: width 0.15s; border-radius: 6px; }
        .typ-bar-row.me .typ-bar-fill { background: var(--secondary-color); }
        .typ-bar-row.opp .typ-bar-fill { background: var(--primary-color); }
        .typ-bar-fill.error { background: #ef4444 !important; }
        .typ-wpm { width: 4.5em; text-align: right; color: #ccc; font-variant-numeric: tabular-nums; }
        .typ-message { color: #aaa; font-size: 0.9rem; min-height: 1.2em; text-align: center; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="typ-wrap">
            <div class="typ-info">Type the sentence exactly. First to finish wins; when time runs out, furthest ahead wins.</div>
            <div class="typ-timer" id="typ-timer">120</div>
            <div class="typ-sentence" id="typ-sentence"></div>
            <textarea class="typ-input" id="typ-input" rows="3" placeholder="Start typing here..." autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" disabled></textarea>
            <div class="typ-bars">
                <div class="typ-bar-row me">
                    <span class="typ-bar-label">You</span>
                    <div class="typ-bar"><div class="typ-bar-fill" id="typ-fill-me"></div></div>
                    <span class="typ-wpm" id="typ-wpm-me">0 wpm</span>
                </div>
                <div class="typ-bar-row opp">
                    <span class="typ-bar-label">Opp</span>
                    <div class="typ-bar"><div class="typ-bar-fill" id="typ-fill-opp"></div></div>
                    <span class="typ-wpm" id="typ-wpm-opp">0 wpm</span>
                </div>
            </div>
            <div class="typ-message" id="typ-message"></div>
        </div>
    `;

    const statusEl = document.getElementById('game-status');
    const timerEl = document.getElementById('typ-timer');
    const sentenceEl = document.getElementById('typ-sentence');
    const inputEl = document.getElementById('typ-input');
    const fillMe = document.getElementById('typ-fill-me');
    const fillOpp = document.getElementById('typ-fill-opp');
    const wpmMe = document.getElementById('typ-wpm-me');
    const wpmOpp = document.getElementById('typ-wpm-opp');
    const messageEl = document.getElementById('typ-message');

    const myIdx = playerIndex;
    const MAX_TEXT = 400;
    let lastState = initialState || null;
    let lastMessage = null;

    function canType() {
        if (!canAct(lastState, myIdx)) return false;
        if (!lastState) return false;
        return lastState.started === true && !lastState.paused;
    }

    // No pasting or dropping text into the race.
    inputEl.addEventListener('paste', (e) => e.preventDefault());
    inputEl.addEventListener('drop', (e) => e.preventDefault());
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.preventDefault(); // sentences never contain newlines
    });
    inputEl.addEventListener('input', () => {
        if (!canType()) return;
        if (inputEl.value.length > MAX_TEXT) inputEl.value = inputEl.value.slice(0, MAX_TEXT);
        socket.emit('make_move', { roomId, move: { text: inputEl.value } });
        renderSentence(lastState);
    });

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => {
        if (typeof showToast === 'function') showToast(msg);
    });

    if (initialState) render(initialState);

    // Sentence coloring: server-confirmed progress in green, locally typed-but-wrong chars in red.
    function renderSentence(state) {
        if (!state) return;
        const sentence = state.sentence || '';
        const progress = state.progress ? state.progress[myIdx] : 0;
        const typedLen = Math.min(inputEl.value.length, sentence.length);
        const errEnd = state.hasError && state.hasError[myIdx] ? Math.max(typedLen, progress) : progress;

        sentenceEl.innerHTML = '';
        const ok = document.createElement('span');
        ok.className = 'ok';
        ok.textContent = sentence.slice(0, progress);
        sentenceEl.appendChild(ok);
        if (errEnd > progress) {
            const err = document.createElement('span');
            err.className = 'err';
            err.textContent = sentence.slice(progress, errEnd);
            sentenceEl.appendChild(err);
        }
        const rest = document.createElement('span');
        rest.className = 'rest' + (!state.isGameOver ? ' cursor' : '');
        rest.textContent = sentence.slice(errEnd);
        sentenceEl.appendChild(rest);
    }

    function render(state) {
        lastState = state;
        const sentence = state.sentence || '';
        const total = sentence.length || 1;
        const oppIdx = 1 - myIdx;

        // Timer
        timerEl.textContent = state.paused ? '⏸' : (state.started === false ? '•••' : state.timeLeft);
        timerEl.className = 'typ-timer' + (state.started && !state.paused && !state.isGameOver && state.timeLeft <= 10 ? ' urgent' : '');

        renderSentence(state);

        // Progress bars and WPM
        const myP = state.progress ? state.progress[myIdx] : 0;
        const oppP = state.progress ? state.progress[oppIdx] : 0;
        fillMe.style.width = `${Math.round((myP / total) * 100)}%`;
        fillOpp.style.width = `${Math.round((oppP / total) * 100)}%`;
        fillMe.classList.toggle('error', Boolean(state.hasError && state.hasError[myIdx]));
        fillOpp.classList.toggle('error', Boolean(state.hasError && state.hasError[oppIdx]));
        const wpm = state.wpm || [0, 0];
        wpmMe.textContent = `${wpm[myIdx]} wpm`;
        wpmOpp.textContent = `${wpm[oppIdx]} wpm`;

        // Input
        const active = canType();
        inputEl.disabled = !active;
        inputEl.classList.toggle('error', Boolean(state.hasError && state.hasError[myIdx]));
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
            statusEl.textContent = 'Type! ' + Math.round((myP / total) * 100) + '% done';
        }
    }
}
