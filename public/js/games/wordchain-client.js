function initWordChain(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('wordchain-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'wordchain-styles';
    style.innerHTML = `
        .wc-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            width: 100%;
            max-width: 500px;
            margin: 0 auto;
        }
        .wc-timer {
            font-size: clamp(2rem, 6vw, 3rem);
            font-weight: bold;
            color: var(--secondary-color);
            transition: color 0.3s;
        }
        .wc-timer.urgent {
            color: #ef4444;
            animation: pulse 0.5s infinite alternate;
        }
        @keyframes pulse {
            from { opacity: 1; }
            to { opacity: 0.5; }
        }
        .wc-hint {
            font-size: 1.1rem;
            color: #aaa;
        }
        .wc-hint strong {
            color: var(--primary-color);
            font-size: 1.3rem;
            text-transform: uppercase;
        }
        .wc-counts {
            display: flex;
            gap: 24px;
            font-size: 1rem;
            font-weight: bold;
        }
        .wc-count-p0 { color: var(--primary-color); }
        .wc-count-p1 { color: var(--secondary-color); }
        .wc-words {
            width: 100%;
            max-height: clamp(150px, 30vh, 250px);
            overflow-y: auto;
            background: #222;
            border-radius: 8px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .wc-word {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 1rem;
            animation: fadeIn 0.3s;
        }
        .wc-word.p0 {
            background: rgba(187, 134, 252, 0.2);
            color: var(--primary-color);
            align-self: flex-start;
        }
        .wc-word.p1 {
            background: rgba(3, 218, 198, 0.2);
            color: var(--secondary-color);
            align-self: flex-end;
        }
        .wc-word .wc-chain-letter {
            text-decoration: underline;
            font-weight: bold;
        }
        .wc-input-row {
            display: flex;
            gap: 10px;
            width: 100%;
        }
        .wc-input {
            flex: 1;
            padding: 12px;
            background: #222;
            border: 2px solid #444;
            border-radius: 8px;
            color: white;
            font-size: 1.1rem;
            outline: none;
        }
        .wc-input:focus {
            border-color: var(--primary-color);
        }
        .wc-input:disabled {
            opacity: 0.4;
        }
        .wc-submit {
            padding: 12px 20px;
            background: var(--primary-color);
            color: #000;
            border: none;
            border-radius: 8px;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            touch-action: manipulation;
            transition: transform 0.1s;
        }
        .wc-submit:active { transform: scale(0.95); }
        .wc-submit:disabled { opacity: 0.4; cursor: not-allowed; }
        .wc-message {
            color: #ef4444;
            font-size: 0.9rem;
            min-height: 1.2em;
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="wc-container">
            <div class="wc-timer" id="wc-timer">15</div>
            <div class="wc-hint" id="wc-hint">Type any word to start!</div>
            <div class="wc-counts">
                <span class="wc-count-p0">You: <span id="wc-c-me">0</span></span>
                <span class="wc-count-p1">Opp: <span id="wc-c-opp">0</span></span>
            </div>
            <div class="wc-words" id="wc-words"></div>
            <div class="wc-message" id="wc-message"></div>
            <div class="wc-input-row">
                <input type="text" class="wc-input" id="wc-input" placeholder="Type a word..." autocomplete="off" autocapitalize="off">
                <button class="wc-submit" id="wc-submit">Send</button>
            </div>
        </div>
    `;

    const statusEl = document.getElementById('game-status');
    const timerEl = document.getElementById('wc-timer');
    const hintEl = document.getElementById('wc-hint');
    const wordsEl = document.getElementById('wc-words');
    const inputEl = document.getElementById('wc-input');
    const submitEl = document.getElementById('wc-submit');
    const messageEl = document.getElementById('wc-message');
    const myCountEl = document.getElementById('wc-c-me');
    const oppCountEl = document.getElementById('wc-c-opp');
    const myIdx = playerIndex;
    let lastServerMessage = null;

    function submitWord() {
        const word = inputEl.value.trim();
        if (!word) return;
        socket.emit('make_move', { roomId, move: { word } });
        inputEl.value = '';
    }

    submitEl.addEventListener('click', submitWord);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitWord();
    });

    socket.off('game_state');
    socket.off('invalid_move');

    socket.on('game_state', (data) => render(data));
    socket.on('invalid_move', (msg) => {
        messageEl.textContent = msg;
        setTimeout(() => { messageEl.textContent = ''; }, 3000);
    });

    if (initialState) render(initialState);

    function render(state) {
        const { words, lastLetter, timeLeft, message, activePlayerIndex, isGameOver, winner, started, paused, minLength, maxLength } = state;
        const lenHint = minLength && maxLength ? ` (${minLength}-${maxLength} letters)` : '';

        // Timer
        timerEl.textContent = paused ? '\u23F8' : (started === false ? '\u2022\u2022\u2022' : timeLeft);
        timerEl.className = 'wc-timer';
        if (started !== false && !paused && timeLeft <= 5) timerEl.classList.add('urgent');

        // Hint
        if (lastLetter) {
            hintEl.innerHTML = `Next word must start with: <strong>${lastLetter}</strong>`;
        } else {
            hintEl.textContent = `Type any word${lenHint}!`;
        }

        // Words list
        wordsEl.innerHTML = '';
        let myCount = 0, oppCount = 0;
        words.forEach((entry, i) => {
            const div = document.createElement('div');
            div.className = `wc-word p${entry.player}`;
            const w = entry.word;
            // Highlight last letter
            div.innerHTML = w.slice(0, -1) + `<span class="wc-chain-letter">${w[w.length - 1]}</span>`;
            wordsEl.appendChild(div);
            if (entry.player === myIdx) myCount++;
            else oppCount++;
        });
        wordsEl.scrollTop = wordsEl.scrollHeight;
        myCountEl.textContent = myCount;
        oppCountEl.textContent = oppCount;

        // Input state
        const isMyTurn = activePlayerIndex === myIdx;
        inputEl.disabled = !isMyTurn || isGameOver || Boolean(paused);
        submitEl.disabled = !isMyTurn || isGameOver || Boolean(paused);

        if (isMyTurn && !isGameOver) {
            inputEl.focus();
        }

        // Message
        // Only touch the message line when the server's message changes, so a
        // rejected-word notice is not wiped by the once-a-second clock tick.
        const serverMsg = message || (started === false && !isGameOver ? 'Clock starts when both players are ready' : '');
        if (serverMsg !== lastServerMessage) {
            lastServerMessage = serverMsg;
            messageEl.textContent = serverMsg;
        }

        // Status
        if (isGameOver) {
            if (winner === 'draw') {
                statusEl.textContent = "It's a Draw!";
                showStatus("It's a Draw!");
            } else {
                const msg = winner === myIdx ? "You Won!" : "You Lost!";
                statusEl.textContent = msg;
                showStatus(msg);
            }
        } else {
            statusEl.textContent = isMyTurn ? "Your Turn - Type fast!" : "Opponent's Turn";
            statusEl.style.color = isMyTurn ? "#4caf50" : "#fff";
        }
    }
}
