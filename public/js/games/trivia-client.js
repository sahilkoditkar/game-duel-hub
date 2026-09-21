function initTrivia(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('trivia-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'trivia-styles';
    style.textContent = `
        .tv-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 460px;
            margin: 0 auto;
            user-select: none;
        }
        .tv-info { font-size: 0.85rem; color: #888; text-align: center; }
        .tv-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            font-weight: bold;
        }
        .tv-score { font-size: 1.05rem; }
        .tv-score .me { color: var(--secondary-color); }
        .tv-score .opp { color: var(--primary-color); }
        .tv-progress { color: #aaa; font-size: 0.9rem; font-weight: normal; }
        .tv-timer {
            font-size: clamp(1.8rem, 6vw, 2.6rem);
            font-weight: bold;
            color: var(--secondary-color);
            min-width: 2.2em;
            text-align: center;
        }
        .tv-timer.urgent { color: #ef4444; animation: tv-pulse 0.5s infinite alternate; }
        @keyframes tv-pulse { from { opacity: 1; } to { opacity: 0.5; } }
        .tv-card {
            width: 100%;
            background: #222;
            border-radius: 12px;
            padding: 18px 14px;
            box-sizing: border-box;
            font-size: clamp(1.05rem, 4.2vw, 1.3rem);
            line-height: 1.35;
            text-align: center;
            min-height: 4.5em;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .tv-options {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            width: 100%;
        }
        .tv-opt {
            width: 100%;
            padding: 14px 12px;
            border: 2px solid #444;
            background: #2c2c2c;
            color: var(--text-color, #fff);
            border-radius: 10px;
            font-size: 1rem;
            text-align: left;
            cursor: pointer;
            touch-action: manipulation;
            transition: transform 0.1s, border-color 0.15s, background 0.15s;
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .tv-opt .tv-letter {
            flex: 0 0 auto;
            width: 1.8em;
            height: 1.8em;
            border-radius: 50%;
            background: #444;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 0.85rem;
        }
        .tv-opt:active:not(:disabled) { transform: scale(0.98); }
        .tv-opt:disabled { cursor: default; opacity: 0.85; }
        .tv-opt.picked { border-color: var(--secondary-color); background: #14332f; }
        .tv-opt.correct { border-color: #10b981; background: #123c2e; }
        .tv-opt.correct .tv-letter { background: #10b981; color: #000; }
        .tv-opt.wrong { border-color: #ef4444; background: #3a1c1c; }
        .tv-opt.wrong .tv-letter { background: #ef4444; color: #000; }
        .tv-opt.opp-pick { box-shadow: inset 0 0 0 2px var(--primary-color); }
        .tv-hint { min-height: 1.4em; color: #aaa; font-size: 0.9rem; text-align: center; }
        .tv-legend { font-size: 0.75rem; color: #666; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Trivia Duel</h3>
        <div class="tv-wrap">
            <div class="tv-info">Ten questions, 15 seconds each. Tap an answer to lock it in. Most correct wins.</div>
            <div class="tv-top">
                <div class="tv-score"><span class="me">You <span id="tv-me">0</span></span> &nbsp;·&nbsp; <span class="opp">Opp <span id="tv-opp">0</span></span></div>
                <div class="tv-timer" id="tv-timer">15</div>
                <div class="tv-progress" id="tv-progress">Q 1 / 10</div>
            </div>
            <div class="tv-card" id="tv-question"></div>
            <div class="tv-options" id="tv-options"></div>
            <div class="tv-hint" id="tv-hint"></div>
            <div class="tv-legend" id="tv-legend"></div>
        </div>
    `;

    const statusEl = document.getElementById('game-status');
    const meEl = document.getElementById('tv-me');
    const oppEl = document.getElementById('tv-opp');
    const timerEl = document.getElementById('tv-timer');
    const progressEl = document.getElementById('tv-progress');
    const questionEl = document.getElementById('tv-question');
    const optionsEl = document.getElementById('tv-options');
    const hintEl = document.getElementById('tv-hint');
    const legendEl = document.getElementById('tv-legend');
    const myIdx = playerIndex;
    let lastState = initialState || null;
    const LETTERS = ['A', 'B', 'C', 'D'];

    const buttons = [];
    for (let i = 0; i < 4; i++) {
        const btn = document.createElement('button');
        btn.className = 'tv-opt';
        btn.type = 'button';
        const letter = document.createElement('span');
        letter.className = 'tv-letter';
        letter.textContent = LETTERS[i];
        const text = document.createElement('span');
        text.className = 'tv-text';
        btn.appendChild(letter);
        btn.appendChild(text);
        btn.addEventListener('click', () => {
            if (!canAct(lastState, myIdx)) return;
            if (!lastState || lastState.phase !== 'answering' || !lastState.started || lastState.paused) return;
            if (lastState.myAnswer !== null && lastState.myAnswer !== undefined) return;
            socket.emit('make_move', { roomId, move: { answer: i } });
        });
        optionsEl.appendChild(btn);
        buttons.push({ btn, text });
    }

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => {
        if (typeof showToast === 'function') showToast(msg);
        else alert(msg);
    });

    if (initialState) render(initialState);

    function render(state) {
        lastState = state;
        const { questionIndex, total, question, myAnswer, opponentAnswered, phase,
            correctIndex, lastResult, scores, timeLeft, started, paused, isGameOver, winner } = state;
        const oppIdx = 1 - myIdx;
        const revealed = phase === 'reveal' || phase === 'finished';

        meEl.textContent = scores[myIdx];
        oppEl.textContent = scores[oppIdx];
        progressEl.textContent = `Q ${Math.min(questionIndex + 1, total)} / ${total}`;

        // Timer
        timerEl.className = 'tv-timer';
        if (paused) timerEl.textContent = '⏸';
        else if (started === false) timerEl.textContent = '•••';
        else if (revealed) timerEl.textContent = '✓';
        else {
            timerEl.textContent = timeLeft;
            if (timeLeft <= 5) timerEl.classList.add('urgent');
        }

        // Question + options
        if (question) {
            questionEl.textContent = question.q;
            buttons.forEach(({ btn, text }, i) => {
                text.textContent = question.options[i] !== undefined ? question.options[i] : '';
                btn.className = 'tv-opt';
                const mine = myAnswer === i;
                if (revealed) {
                    btn.disabled = true;
                    if (correctIndex === i) btn.classList.add('correct');
                    else if (mine) btn.classList.add('wrong');
                    if (lastResult && lastResult.answers[oppIdx] === i) btn.classList.add('opp-pick');
                } else {
                    if (mine) btn.classList.add('picked');
                    btn.disabled = isGameOver || Boolean(paused) || started === false || myAnswer !== null;
                }
            });
            legendEl.textContent = revealed ? 'Green = correct · Red = your wrong pick · Outlined = opponent\'s pick' : '';
        } else {
            questionEl.textContent = started === false ? 'Get ready...' : '';
            buttons.forEach(({ btn, text }) => { text.textContent = ''; btn.className = 'tv-opt'; btn.disabled = true; });
            legendEl.textContent = '';
        }

        // Hint line
        if (isGameOver) {
            hintEl.textContent = `Final score ${scores[myIdx]} - ${scores[oppIdx]}`;
        } else if (paused) {
            hintEl.textContent = 'Paused - waiting for your opponent to reconnect';
        } else if (started === false) {
            hintEl.textContent = 'Clock starts when both are ready';
        } else if (revealed) {
            const oppPick = lastResult ? lastResult.answers[oppIdx] : null;
            const meRight = lastResult && lastResult.answers[myIdx] === lastResult.correctIndex;
            const oppRight = lastResult && oppPick === lastResult.correctIndex;
            hintEl.textContent = (meRight ? 'You got it! ' : (myAnswer === null ? 'You ran out of time. ' : 'Not quite. '))
                + (oppRight ? 'Opponent got it too.' : (oppPick === null ? 'Opponent did not answer.' : 'Opponent missed.'));
        } else if (myAnswer !== null && !opponentAnswered) {
            hintEl.textContent = 'Locked in. Waiting for opponent...';
        } else if (myAnswer === null && opponentAnswered) {
            hintEl.textContent = 'Opponent has answered!';
        } else if (myAnswer !== null && opponentAnswered) {
            hintEl.textContent = 'Both answered';
        } else {
            hintEl.textContent = 'Tap an answer';
        }

        // Status line
        if (isGameOver) {
            const msg = winner === 'draw' ? "It's a Draw!" : (winner === myIdx ? 'You Won!' : 'You Lost!');
            statusEl.textContent = msg;
            showStatus(msg);
        } else if (started === false) {
            statusEl.textContent = 'Waiting for both players';
        } else if (revealed) {
            statusEl.textContent = 'Answer revealed';
        } else if (myAnswer !== null) {
            statusEl.textContent = 'Answer locked';
        } else {
            statusEl.textContent = 'Your answer?';
        }
    }
}
