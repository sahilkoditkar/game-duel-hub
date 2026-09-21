function initSnakes(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('snakes-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'snakes-styles';
    style.textContent = `
        .sn-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: 100%;
            max-width: 420px;
            margin: 0 auto;
            user-select: none;
        }
        .sn-board {
            display: grid;
            grid-template-columns: repeat(10, 1fr);
            gap: 2px;
            width: 100%;
            max-width: min(94vw, 400px);
            aspect-ratio: 1;
            background: #111;
            padding: 3px;
            border-radius: 10px;
        }
        .sn-cell {
            position: relative;
            background: #2a2a2a;
            border-radius: 3px;
            display: flex;
            align-items: flex-start;
            justify-content: flex-start;
            font-size: clamp(0.5rem, 2.2vw, 0.7rem);
            color: #777;
            padding: 1px 2px;
            overflow: hidden;
        }
        .sn-cell.alt { background: #333; }
        .sn-cell.ladder { background: #1f3a2a; }
        .sn-cell.snake { background: #3a1f24; }
        .sn-cell.goal { background: #3a3410; }
        .sn-cell .sn-num { position: absolute; top: 1px; left: 2px; }
        .sn-cell .sn-icon {
            position: absolute; right: 1px; bottom: 0; font-size: clamp(0.6rem, 2.6vw, 0.85rem); line-height: 1;
        }
        .sn-cell .sn-dest {
            position: absolute; left: 2px; bottom: 0; font-size: clamp(0.45rem, 2vw, 0.6rem); color: #aaa;
        }
        .sn-cell.ladder .sn-dest { color: #4ade80; }
        .sn-cell.snake .sn-dest { color: #f87171; }
        .sn-tokens {
            position: absolute; inset: 0;
            display: flex; align-items: center; justify-content: center; gap: 1px;
            pointer-events: none;
        }
        .sn-token {
            width: 42%; height: 42%; border-radius: 50%;
            border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.6);
            transition: transform 0.2s;
        }
        .sn-token.p0 { background: var(--primary-color); }
        .sn-token.p1 { background: var(--secondary-color); }
        .sn-start {
            display: flex; gap: 12px; align-items: center; font-size: 0.85rem; color: #aaa;
            min-height: 24px;
        }
        .sn-start .sn-token { width: 16px; height: 16px; display: inline-block; }
        .sn-panel {
            display: flex; gap: 12px; width: 100%; align-items: stretch;
        }
        .sn-player {
            flex: 1; background: #222; border-radius: 8px; padding: 8px 10px; text-align: center;
            border: 2px solid transparent;
        }
        .sn-player.active { border-color: #4caf50; }
        .sn-player .sn-name { font-size: 0.8rem; color: #aaa; }
        .sn-player .sn-pos { font-size: 1.4rem; font-weight: bold; }
        .sn-player.p0 .sn-pos { color: var(--primary-color); }
        .sn-player.p1 .sn-pos { color: var(--secondary-color); }
        .sn-roll {
            width: 100%; padding: 16px; border: none; border-radius: 10px;
            font-size: 1.2rem; font-weight: bold; cursor: pointer;
            background: var(--secondary-color); color: #000;
            touch-action: manipulation; transition: transform 0.1s;
        }
        .sn-roll:active { transform: scale(0.97); }
        .sn-roll:disabled { opacity: 0.35; cursor: not-allowed; }
        .sn-die {
            width: 56px; height: 56px; border-radius: 10px; background: #fff; color: #111;
            display: flex; align-items: center; justify-content: center;
            font-size: 2rem; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        }
        .sn-last {
            display: flex; gap: 12px; align-items: center; width: 100%;
            background: #222; border-radius: 8px; padding: 8px 10px; min-height: 60px;
        }
        .sn-last-text { flex: 1; font-size: 0.9rem; line-height: 1.3; }
        .sn-info { font-size: 0.85rem; color: #888; text-align: center; }
        .sn-you { font-size: 0.85rem; color: #aaa; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="sn-wrap">
            <div class="sn-info">Roll to move. Ladders lift you up, snakes drop you down. A 6 rolls again. Land exactly on 100 to win!</div>
            <div class="sn-board" id="sn-board"></div>
            <div class="sn-start" id="sn-start"></div>
            <div class="sn-panel">
                <div class="sn-player p0" id="sn-p0"><div class="sn-name">Player 1</div><div class="sn-pos">0</div></div>
                <div class="sn-player p1" id="sn-p1"><div class="sn-name">Player 2</div><div class="sn-pos">0</div></div>
            </div>
            <div class="sn-last">
                <div class="sn-die" id="sn-die">-</div>
                <div class="sn-last-text" id="sn-last-text">No rolls yet.</div>
            </div>
            <button class="sn-roll" id="sn-roll" disabled>Roll</button>
            <div class="sn-you" id="sn-you"></div>
        </div>
    `;

    const boardEl = document.getElementById('sn-board');
    const statusEl = document.getElementById('game-status');
    const startEl = document.getElementById('sn-start');
    const dieEl = document.getElementById('sn-die');
    const lastTextEl = document.getElementById('sn-last-text');
    const rollBtn = document.getElementById('sn-roll');
    const p0El = document.getElementById('sn-p0');
    const p1El = document.getElementById('sn-p1');
    const youEl = document.getElementById('sn-you');
    const myIdx = playerIndex;
    let lastState = initialState || null;

    youEl.textContent = `You are Player ${myIdx + 1} (${myIdx === 0 ? 'purple' : 'teal'})`;
    p0El.querySelector('.sn-name').textContent = myIdx === 0 ? 'You' : 'Opponent';
    p1El.querySelector('.sn-name').textContent = myIdx === 1 ? 'You' : 'Opponent';

    const ladders = (initialState && initialState.ladders) || { 3: 22, 5: 8, 11: 26, 20: 29, 27: 56, 36: 44, 51: 67, 71: 91, 80: 99 };
    const snakes = (initialState && initialState.snakes) || { 17: 4, 19: 7, 21: 9, 54: 34, 62: 18, 64: 60, 87: 24, 93: 73, 95: 75, 98: 79 };

    // Boustrophedon: bottom row 1-10 left-to-right, next row right-to-left, ... 100 ends top-left.
    const cellByNumber = {};
    for (let rowFromTop = 0; rowFromTop < 10; rowFromTop++) {
        const r = 9 - rowFromTop; // 0 = bottom row
        for (let i = 0; i < 10; i++) {
            const n = r % 2 === 0 ? r * 10 + i + 1 : r * 10 + (10 - i);
            const cell = document.createElement('div');
            cell.className = 'sn-cell' + ((r + i) % 2 ? ' alt' : '');
            const num = document.createElement('span');
            num.className = 'sn-num';
            num.textContent = String(n);
            cell.appendChild(num);
            if (ladders[n] !== undefined) {
                cell.classList.add('ladder');
                cell.appendChild(icon('\u{1FA9C}'));
                cell.appendChild(dest('↑' + ladders[n]));
            } else if (snakes[n] !== undefined) {
                cell.classList.add('snake');
                cell.appendChild(icon('\u{1F40D}'));
                cell.appendChild(dest('↓' + snakes[n]));
            } else if (n === 100) {
                cell.classList.add('goal');
                cell.appendChild(icon('\u{1F3C1}'));
            }
            const tokens = document.createElement('div');
            tokens.className = 'sn-tokens';
            cell.appendChild(tokens);
            boardEl.appendChild(cell);
            cellByNumber[n] = tokens;
        }
    }
    function icon(t) { const s = document.createElement('span'); s.className = 'sn-icon'; s.textContent = t; return s; }
    function dest(t) { const s = document.createElement('span'); s.className = 'sn-dest'; s.textContent = t; return s; }

    rollBtn.addEventListener('click', () => {
        if (!canAct(lastState, myIdx)) return;
        rollBtn.disabled = true; // re-enabled by the next state
        socket.emit('make_move', { roomId, move: { action: 'roll' } });
    });

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => {
        if (typeof showToast === 'function') showToast(msg); else alert(msg);
        if (lastState) rollBtn.disabled = !canAct(lastState, myIdx);
    });

    if (initialState) render(initialState);

    function render(state) {
        lastState = state;
        const positions = Array.isArray(state.positions) ? state.positions : [0, 0];

        // Tokens
        Object.keys(cellByNumber).forEach(n => { cellByNumber[n].innerHTML = ''; });
        startEl.innerHTML = '';
        let anyAtStart = false;
        positions.forEach((pos, p) => {
            const tok = document.createElement('div');
            tok.className = 'sn-token p' + p;
            if (pos >= 1 && cellByNumber[pos]) {
                cellByNumber[pos].appendChild(tok);
            } else {
                anyAtStart = true;
                startEl.appendChild(tok);
            }
        });
        if (anyAtStart) {
            const lbl = document.createElement('span');
            lbl.textContent = 'waiting at the start';
            startEl.appendChild(lbl);
        }

        p0El.querySelector('.sn-pos').textContent = String(positions[0]);
        p1El.querySelector('.sn-pos').textContent = String(positions[1]);
        p0El.classList.toggle('active', !state.isGameOver && state.activePlayerIndex === 0);
        p1El.classList.toggle('active', !state.isGameOver && state.activePlayerIndex === 1);

        // Last roll
        const lr = state.lastRoll;
        if (lr) {
            dieEl.textContent = String(lr.value);
            const who = lr.player === myIdx ? 'You' : 'Opponent';
            let text = `${who} rolled a ${lr.value}`;
            if (lr.to === lr.from && lr.from + lr.value > 100) {
                text += ` and stayed on ${lr.from} (needs exactly ${100 - lr.from}).`;
            } else if (lr.via === 'ladder') {
                text += `, climbed a ladder from ${lr.from + lr.value} up to ${lr.to}!`;
            } else if (lr.via === 'snake') {
                text += `, hit a snake on ${lr.from + lr.value} and slid down to ${lr.to}.`;
            } else {
                text += ` and moved to ${lr.to}.`;
            }
            if (lr.bonus) text += ' Bonus roll!';
            lastTextEl.textContent = text;
        } else {
            dieEl.textContent = '-';
            lastTextEl.textContent = 'No rolls yet.';
        }

        rollBtn.disabled = !canAct(state, myIdx);

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
