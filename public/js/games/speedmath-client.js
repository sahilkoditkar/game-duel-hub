function initSpeedMath(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('speedmath-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'speedmath-styles';
    style.textContent = `
        .sm-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 420px;
            margin: 0 auto;
            user-select: none;
        }
        .sm-info { font-size: 0.85rem; color: #888; text-align: center; }
        .sm-score {
            display: flex;
            gap: 10px;
            align-items: center;
            font-weight: bold;
            font-size: 1.05rem;
        }
        .sm-score .me { color: var(--secondary-color); }
        .sm-score .opp { color: var(--primary-color); }
        .sm-score .round { color: #aaa; font-size: 0.9rem; font-weight: normal; margin-left: 8px; }
        .sm-question {
            width: 100%;
            background: #222;
            border-radius: 14px;
            padding: 18px 10px;
            box-sizing: border-box;
            text-align: center;
            font-size: clamp(2.2rem, 11vw, 3.4rem);
            font-weight: bold;
            letter-spacing: 0.04em;
            min-height: 1.6em;
            line-height: 1.2;
        }
        .sm-question.reveal { color: #10b981; font-size: clamp(1.4rem, 7vw, 2.2rem); }
        .sm-question.void { color: #f59e0b; }
        .sm-locks {
            display: flex;
            gap: 14px;
            font-size: 0.85rem;
            min-height: 1.3em;
        }
        .sm-lock { color: #666; }
        .sm-lock.on { color: #ef4444; font-weight: bold; }
        .sm-input-row { display: flex; gap: 8px; width: 100%; }
        .sm-input {
            flex: 1;
            padding: 12px;
            background: #222;
            border: 2px solid #444;
            border-radius: 10px;
            color: #fff;
            font-size: 1.6rem;
            text-align: center;
            outline: none;
            min-width: 0;
        }
        .sm-input:focus { border-color: var(--primary-color); }
        .sm-input:disabled { opacity: 0.4; }
        .sm-submit {
            padding: 12px 18px;
            background: var(--secondary-color);
            color: #000;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            touch-action: manipulation;
        }
        .sm-submit:disabled { opacity: 0.4; cursor: not-allowed; }
        .sm-pad {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            width: 100%;
        }
        .sm-key {
            aspect-ratio: 1.6;
            border: none;
            border-radius: 10px;
            background: #333;
            color: #fff;
            font-size: 1.4rem;
            font-weight: bold;
            cursor: pointer;
            touch-action: manipulation;
            transition: transform 0.08s;
        }
        .sm-key:active:not(:disabled) { transform: scale(0.95); background: #444; }
        .sm-key:disabled { opacity: 0.4; cursor: not-allowed; }
        .sm-key.fn { background: #2c2c2c; color: #ccc; font-size: 1.1rem; }
        .sm-key.go { background: var(--primary-color); color: #000; }
        .sm-hint { min-height: 1.3em; color: #aaa; font-size: 0.9rem; text-align: center; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Speed Math</h3>
        <div class="sm-wrap">
            <div class="sm-info">First correct answer wins the round. A wrong answer locks you out until the next one. First to 3.</div>
            <div class="sm-score">
                <span class="me">You <span id="sm-me">0</span></span><span>-</span><span class="opp"><span id="sm-opp">0</span> Opp</span>
                <span class="round" id="sm-round">Round 1</span>
            </div>
            <div class="sm-question" id="sm-question"></div>
            <div class="sm-locks">
                <span class="sm-lock" id="sm-lock-me">You: in</span>
                <span class="sm-lock" id="sm-lock-opp">Opp: in</span>
            </div>
            <div class="sm-input-row">
                <input class="sm-input" id="sm-input" type="text" inputmode="numeric" pattern="-?[0-9]*" autocomplete="off" placeholder="?">
                <button class="sm-submit" id="sm-submit">Go</button>
            </div>
            <div class="sm-pad" id="sm-pad"></div>
            <div class="sm-hint" id="sm-hint"></div>
        </div>
    `;

    const statusEl = document.getElementById('game-status');
    const meEl = document.getElementById('sm-me');
    const oppEl = document.getElementById('sm-opp');
    const roundEl = document.getElementById('sm-round');
    const questionEl = document.getElementById('sm-question');
    const lockMeEl = document.getElementById('sm-lock-me');
    const lockOppEl = document.getElementById('sm-lock-opp');
    const inputEl = document.getElementById('sm-input');
    const submitEl = document.getElementById('sm-submit');
    const padEl = document.getElementById('sm-pad');
    const hintEl = document.getElementById('sm-hint');
    const myIdx = playerIndex;
    let lastState = initialState || null;
    let lastQuestion = null;

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'];
    const keyButtons = [];
    keys.forEach(k => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sm-key' + (k === 'del' ? ' fn' : k === 'go' ? ' go' : '');
        btn.textContent = k === 'del' ? '⌫' : k === 'go' ? '↵' : k;
        btn.addEventListener('click', () => {
            if (!canSubmit()) return;
            if (k === 'del') inputEl.value = inputEl.value.slice(0, -1);
            else if (k === 'go') submit();
            else if (inputEl.value.length < 7) inputEl.value += k;
        });
        padEl.appendChild(btn);
        keyButtons.push(btn);
    });

    function canSubmit() {
        if (!canAct(lastState, myIdx)) return false;
        if (!lastState) return true;
        return lastState.phase === 'question' && !lastState.myLocked;
    }

    function submit() {
        if (!canSubmit()) return;
        const raw = inputEl.value.trim();
        if (!/^-?\d+$/.test(raw)) return;
        const answer = parseInt(raw, 10);
        if (!Number.isSafeInteger(answer)) return;
        socket.emit('make_move', { roomId, move: { answer } });
        inputEl.value = '';
    }

    submitEl.addEventListener('click', submit);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
    inputEl.addEventListener('input', () => {
        inputEl.value = inputEl.value.replace(/[^0-9-]/g, '').slice(0, 8);
    });

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
        const { round, roundWins, winsNeeded, question, myLocked, oppLocked, lastRound, phase, isGameOver, winner } = state;
        const oppIdx = 1 - myIdx;

        meEl.textContent = roundWins[myIdx];
        oppEl.textContent = roundWins[oppIdx];
        roundEl.textContent = isGameOver ? 'Match over' : `Round ${round} · first to ${winsNeeded}`;

        questionEl.className = 'sm-question';
        if (phase === 'reveal' && lastRound) {
            questionEl.classList.add('reveal');
            if (lastRound.winner === null) questionEl.classList.add('void');
            questionEl.textContent = `${lastRound.question} = ${lastRound.answer}`;
        } else {
            questionEl.textContent = question || '';
        }

        // Clear a stale typed answer when a new question arrives.
        if (phase === 'question' && question !== lastQuestion) {
            inputEl.value = '';
            lastQuestion = question;
        }

        lockMeEl.textContent = myLocked ? 'You: locked out' : 'You: in';
        lockMeEl.className = 'sm-lock' + (myLocked ? ' on' : '');
        lockOppEl.textContent = oppLocked ? 'Opp: locked out' : 'Opp: in';
        lockOppEl.className = 'sm-lock' + (oppLocked ? ' on' : '');

        const enabled = !isGameOver && phase === 'question' && !myLocked;
        inputEl.disabled = !enabled;
        submitEl.disabled = !enabled;
        keyButtons.forEach(b => { b.disabled = !enabled; });
        if (enabled && typeof inputEl.focus === 'function' && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
            inputEl.focus();
        }

        if (isGameOver) {
            hintEl.textContent = '';
            const msg = winner === 'draw' ? "It's a Draw!" : (winner === myIdx ? 'You Won!' : 'You Lost!');
            statusEl.textContent = msg;
            showStatus(msg);
        } else if (phase === 'reveal' && lastRound) {
            if (lastRound.winner === null) {
                hintEl.textContent = 'Both locked out - round void, new question coming';
                statusEl.textContent = 'Round void';
            } else if (lastRound.winner === myIdx) {
                hintEl.textContent = 'You were first! Next question coming...';
                statusEl.textContent = 'You won the round';
            } else {
                hintEl.textContent = 'Opponent was first. Next question coming...';
                statusEl.textContent = 'Opponent won the round';
            }
        } else if (myLocked) {
            hintEl.textContent = oppLocked ? 'Both locked out...' : 'Locked out - waiting for opponent';
            statusEl.textContent = 'Locked out this round';
        } else {
            hintEl.textContent = oppLocked ? 'Opponent is locked out. Take your time, but be right!' : 'Type the answer and hit Enter';
            statusEl.textContent = 'Solve it first!';
        }
    }
}
