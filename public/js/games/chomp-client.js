function initChomp(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('chomp-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'chomp-styles';
    style.textContent = `
        .chomp-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 420px;
            margin: 0 auto;
            user-select: none;
        }
        .chomp-bar {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: clamp(3px, 1vw, 5px);
            width: 100%;
            max-width: min(94vw, 400px);
            background: #222;
            padding: clamp(6px, 2vw, 10px);
            border-radius: 12px;
        }
        .chomp-sq {
            aspect-ratio: 1;
            border-radius: 6px;
            background: linear-gradient(145deg, #7b4a2a, #4e2c14);
            box-shadow: inset 0 -3px 0 rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.08);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: clamp(1rem, 4.5vw, 1.4rem);
            transition: opacity 0.25s, transform 0.15s, background 0.15s;
            touch-action: manipulation;
        }
        .chomp-sq.poison { background: linear-gradient(145deg, #5a2a5a, #2e142e); }
        .chomp-sq.gone {
            background: transparent;
            box-shadow: none;
            cursor: default;
            opacity: 0.15;
            pointer-events: none;
        }
        .chomp-sq.preview { background: linear-gradient(145deg, #b37b4f, #7b4a2a); transform: scale(0.94); }
        .chomp-sq.last-bite { outline: 2px dashed #facc15; outline-offset: -2px; }
        .chomp-sq:active:not(.gone) { transform: scale(0.9); }
        .chomp-info { font-size: 0.85rem; color: #888; text-align: center; }
        .chomp-meta {
            display: flex; gap: 20px; justify-content: center; font-size: 0.9rem; color: #aaa; flex-wrap: wrap;
        }
        .chomp-p0 { color: var(--primary-color); font-weight: bold; }
        .chomp-p1 { color: var(--secondary-color); font-weight: bold; }
        @media (hover: hover) {
            .chomp-sq:not(.gone):hover { filter: brightness(1.15); }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="chomp-wrap">
            <div class="chomp-info">Take a square and everything below-right of it. Whoever eats the poison loses.</div>
            <div class="chomp-bar" id="chomp-bar"></div>
            <div class="chomp-meta">
                <span>Squares left: <strong id="chomp-left">28</strong></span>
                <span id="chomp-last">No bites yet</span>
            </div>
            <div class="chomp-meta" id="chomp-you"></div>
        </div>
    `;

    const ROWS = 4, COLS = 7;
    const barEl = document.getElementById('chomp-bar');
    const statusEl = document.getElementById('game-status');
    const leftEl = document.getElementById('chomp-left');
    const lastEl = document.getElementById('chomp-last');
    const youEl = document.getElementById('chomp-you');
    const myIdx = playerIndex;
    let lastState = initialState || null;

    youEl.innerHTML = `<span class="${myIdx === 0 ? 'chomp-p0' : 'chomp-p1'}">You are Player ${myIdx + 1}</span>`;

    const cells = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const sq = document.createElement('div');
            sq.className = 'chomp-sq' + (r === 0 && c === 0 ? ' poison' : '');
            if (r === 0 && c === 0) sq.textContent = '☠';
            sq.addEventListener('click', () => {
                if (sq.classList.contains('gone')) return;
                if (!canAct(lastState, myIdx)) return;
                socket.emit('make_move', { roomId, move: { row: r, col: c } });
            });
            sq.addEventListener('mouseenter', () => setPreview(r, c));
            sq.addEventListener('mouseleave', () => setPreview(-1, -1));
            barEl.appendChild(sq);
            cells.push(sq);
        }
    }

    function setPreview(row, col) {
        const show = row >= 0 && lastState && canAct(lastState, myIdx);
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const sq = cells[r * COLS + c];
                if (show && r >= row && c >= col && !sq.classList.contains('gone')) sq.classList.add('preview');
                else sq.classList.remove('preview');
            }
        }
    }

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => { if (typeof showToast === 'function') showToast(msg); else alert(msg); });

    if (initialState) render(initialState);

    function render(state) {
        lastState = state;
        const grid = Array.isArray(state.grid) ? state.grid : [];
        let left = 0;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const sq = cells[r * COLS + c];
                const present = !!(grid[r] && grid[r][c]);
                sq.classList.toggle('gone', !present);
                sq.classList.remove('preview', 'last-bite');
                if (present) left++;
            }
        }
        leftEl.textContent = String(left);
        const lm = state.lastMove;
        if (lm) {
            const sq = cells[lm.row * COLS + lm.col];
            if (sq) sq.classList.add('last-bite');
            const who = lm.player === myIdx ? 'You' : 'Opponent';
            lastEl.textContent = `${who} bit row ${lm.row + 1}, col ${lm.col + 1} (${lm.removed} square${lm.removed === 1 ? '' : 's'})`;
        } else {
            lastEl.textContent = 'No bites yet';
        }

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
