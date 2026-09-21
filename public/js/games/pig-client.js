function initPig(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('pig-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'pig-styles';
    style.textContent = `
        .pig-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 400px;
            margin: 0 auto;
            user-select: none;
        }
        .pig-info { font-size: 0.85rem; color: #888; text-align: center; }
        .pig-scores { display: flex; gap: 12px; width: 100%; }
        .pig-player {
            flex: 1; background: #222; border-radius: 10px; padding: 10px; text-align: center;
            border: 2px solid transparent;
        }
        .pig-player.active { border-color: #4caf50; }
        .pig-player .pig-name { font-size: 0.8rem; color: #aaa; }
        .pig-player .pig-score { font-size: 1.8rem; font-weight: bold; }
        .pig-player.p0 .pig-score { color: var(--primary-color); }
        .pig-player.p1 .pig-score { color: var(--secondary-color); }
        .pig-bar { height: 6px; background: #333; border-radius: 3px; margin-top: 6px; overflow: hidden; }
        .pig-bar > div { height: 100%; width: 0; transition: width 0.3s; }
        .pig-player.p0 .pig-bar > div { background: var(--primary-color); }
        .pig-player.p1 .pig-bar > div { background: var(--secondary-color); }
        .pig-die {
            width: clamp(90px, 28vw, 120px); height: clamp(90px, 28vw, 120px);
            background: #fff; border-radius: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr);
            padding: 14%; box-sizing: border-box; transition: transform 0.15s;
        }
        .pig-die.bust { background: #fca5a5; }
        .pig-die.roll-anim { transform: rotate(8deg) scale(1.05); }
        .pig-pip { width: 70%; height: 70%; background: #111; border-radius: 50%; place-self: center; visibility: hidden; }
        .pig-pip.on { visibility: visible; }
        .pig-turn { text-align: center; }
        .pig-turn .pig-turn-label { font-size: 0.8rem; color: #aaa; }
        .pig-turn .pig-turn-total { font-size: 1.6rem; font-weight: bold; color: #facc15; }
        .pig-controls { display: flex; gap: 10px; width: 100%; }
        .pig-btn {
            flex: 1; padding: 14px; border: none; border-radius: 10px;
            font-size: 1.1rem; font-weight: bold; cursor: pointer;
            touch-action: manipulation; transition: transform 0.1s;
        }
        .pig-btn:active { transform: scale(0.97); }
        .pig-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .pig-btn.roll { background: var(--secondary-color); color: #000; }
        .pig-btn.hold { background: var(--primary-color); color: #000; }
        .pig-log {
            width: 100%; background: #222; border-radius: 8px; padding: 8px 10px;
            font-size: 0.85rem; min-height: 60px; display: flex; flex-direction: column; gap: 3px;
        }
        .pig-log .p0 { color: var(--primary-color); }
        .pig-log .p1 { color: var(--secondary-color); }
        .pig-log .bust { color: #f87171; }
        .pig-log .muted { color: #777; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="pig-wrap">
            <div class="pig-info">Roll to build a turn total, Hold to bank it. Roll a 1 and you lose the turn total. First to <span id="pig-target">50</span> wins.</div>
            <div class="pig-scores">
                <div class="pig-player p0" id="pig-p0"><div class="pig-name">Player 1</div><div class="pig-score">0</div><div class="pig-bar"><div></div></div></div>
                <div class="pig-player p1" id="pig-p1"><div class="pig-name">Player 2</div><div class="pig-score">0</div><div class="pig-bar"><div></div></div></div>
            </div>
            <div class="pig-die" id="pig-die"></div>
            <div class="pig-turn"><div class="pig-turn-label" id="pig-turn-label">Turn total</div><div class="pig-turn-total" id="pig-turn-total">0</div></div>
            <div class="pig-controls">
                <button class="pig-btn roll" id="pig-roll" disabled>Roll</button>
                <button class="pig-btn hold" id="pig-hold" disabled>Hold</button>
            </div>
            <div class="pig-log" id="pig-log"><span class="muted">No rolls yet.</span></div>
        </div>
    `;

    const statusEl = document.getElementById('game-status');
    const dieEl = document.getElementById('pig-die');
    const turnTotalEl = document.getElementById('pig-turn-total');
    const turnLabelEl = document.getElementById('pig-turn-label');
    const rollBtn = document.getElementById('pig-roll');
    const holdBtn = document.getElementById('pig-hold');
    const logEl = document.getElementById('pig-log');
    const targetEl = document.getElementById('pig-target');
    const pEls = [document.getElementById('pig-p0'), document.getElementById('pig-p1')];
    const myIdx = playerIndex;
    let lastState = initialState || null;
    let lastSeenAction = null;

    pEls[0].querySelector('.pig-name').textContent = myIdx === 0 ? 'You' : 'Opponent';
    pEls[1].querySelector('.pig-name').textContent = myIdx === 1 ? 'You' : 'Opponent';

    // Nine pips in a 3x3 grid; index layout: 0 1 2 / 3 4 5 / 6 7 8
    const pips = [];
    for (let i = 0; i < 9; i++) {
        const pip = document.createElement('div');
        pip.className = 'pig-pip';
        dieEl.appendChild(pip);
        pips.push(pip);
    }
    const FACES = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    function showFace(v) {
        const on = FACES[v] || [];
        pips.forEach((p, i) => p.classList.toggle('on', on.includes(i)));
    }

    function send(action) {
        if (!canAct(lastState, myIdx)) return;
        rollBtn.disabled = true;
        holdBtn.disabled = true;
        socket.emit('make_move', { roomId, move: { action } });
    }
    rollBtn.addEventListener('click', () => send('roll'));
    holdBtn.addEventListener('click', () => {
        if (lastState && lastState.turnTotal === 0) return; // server would reject; roll first
        send('hold');
    });

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => {
        if (typeof showToast === 'function') showToast(msg); else alert(msg);
        if (lastState) setButtons(lastState);
    });

    if (initialState) render(initialState);

    function setButtons(state) {
        const mine = canAct(state, myIdx);
        rollBtn.disabled = !mine;
        holdBtn.disabled = !mine || state.turnTotal === 0;
    }

    function render(state) {
        lastState = state;
        const scores = Array.isArray(state.scores) ? state.scores : [0, 0];
        const target = state.target || 50;
        targetEl.textContent = String(target);

        for (let p = 0; p < 2; p++) {
            pEls[p].querySelector('.pig-score').textContent = String(scores[p]);
            pEls[p].querySelector('.pig-bar > div').style.width = Math.min(100, (scores[p] / target) * 100) + '%';
            pEls[p].classList.toggle('active', !state.isGameOver && state.activePlayerIndex === p);
        }

        turnTotalEl.textContent = String(state.turnTotal || 0);
        if (!state.isGameOver) {
            turnLabelEl.textContent = state.activePlayerIndex === myIdx ? 'Your turn total' : "Opponent's turn total";
        } else {
            turnLabelEl.textContent = 'Turn total';
        }

        const lr = state.lastRoll;
        if (lr) {
            showFace(lr.value);
            dieEl.classList.toggle('bust', !!lr.busted);
        } else {
            showFace(0);
            dieEl.classList.remove('bust');
        }
        const la = state.lastAction;
        const key = la ? `${la.player}-${la.type}-${la.value}-${state.history ? state.history.length : 0}-${scores[0]}-${scores[1]}-${state.turnTotal}` : null;
        if (key && key !== lastSeenAction && la.type !== 'hold') {
            dieEl.classList.add('roll-anim');
            setTimeout(() => dieEl.classList.remove('roll-anim'), 160);
        }
        lastSeenAction = key;

        // Log of recent actions, newest first
        logEl.innerHTML = '';
        const history = Array.isArray(state.history) ? state.history.slice().reverse() : [];
        if (history.length === 0) {
            const s = document.createElement('span');
            s.className = 'muted';
            s.textContent = 'No rolls yet.';
            logEl.appendChild(s);
        }
        history.forEach(h => {
            const line = document.createElement('div');
            const who = document.createElement('span');
            who.className = 'p' + h.player;
            who.textContent = h.player === myIdx ? 'You' : 'Opponent';
            line.appendChild(who);
            const rest = document.createElement('span');
            if (h.type === 'bust') {
                rest.className = 'bust';
                rest.textContent = ' rolled a 1 and busted!';
            } else if (h.type === 'hold') {
                rest.textContent = ` held and banked ${h.value}.`;
            } else {
                rest.textContent = ` rolled a ${h.value}.`;
            }
            line.appendChild(rest);
            logEl.appendChild(line);
        });

        setButtons(state);

        if (state.isGameOver) {
            const msg = state.winner === 'draw' ? "It's a Draw!" : (state.winner === myIdx ? 'You Won!' : 'You Lost!');
            statusEl.textContent = msg;
            statusEl.style.color = '#fff';
            showStatus(msg);
        } else {
            statusEl.textContent = state.activePlayerIndex === myIdx ? 'Your Turn' : "Opponent's Turn";
            statusEl.style.color = state.activePlayerIndex === myIdx ? '#4caf50' : '#fff';
        }
    }
}
