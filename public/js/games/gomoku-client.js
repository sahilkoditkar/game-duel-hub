function initGomoku(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('gomoku-styles');
    if (oldStyle) oldStyle.remove();

    const SIZE = 15;
    const style = document.createElement('style');
    style.id = 'gomoku-styles';
    style.textContent = `
        .gk-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: 100%;
            max-width: 420px;
            margin: 0 auto;
            user-select: none;
        }
        .gk-info {
            font-size: 0.85rem;
            color: #888;
            text-align: center;
        }
        .gk-board {
            display: grid;
            grid-template-columns: repeat(15, 1fr);
            gap: 0;
            width: 100%;
            max-width: min(92vw, 400px);
            aspect-ratio: 1;
            background: #b58b5a;
            border: 4px solid #7a5a35;
            border-radius: 6px;
            box-sizing: border-box;
            touch-action: manipulation;
        }
        .gk-cell {
            position: relative;
            aspect-ratio: 1;
            cursor: pointer;
            touch-action: manipulation;
            background:
                linear-gradient(#5a3d1f, #5a3d1f) center / 100% 1px no-repeat,
                linear-gradient(#5a3d1f, #5a3d1f) center / 1px 100% no-repeat;
        }
        .gk-cell.r0 { background-size: 50% 1px, 1px 100%; background-position: right center, center; }
        .gk-cell.c0 { background-size: 100% 1px, 1px 50%; background-position: center, center bottom; }
        .gk-cell.r0.c0 { background-size: 50% 1px, 1px 50%; background-position: right center, center bottom; }
        .gk-cell.r14 { background-size: 100% 1px, 1px 50%; background-position: center, center top; }
        .gk-cell.c14 { background-size: 50% 1px, 1px 100%; background-position: left center, center; }
        .gk-cell.r0.c14 { background-size: 50% 1px, 1px 50%; background-position: left center, center bottom; }
        .gk-cell.r14.c0 { background-size: 50% 1px, 1px 50%; background-position: right center, center top; }
        .gk-cell.r14.c14 { background-size: 50% 1px, 1px 50%; background-position: left center, center top; }
        .gk-cell::after {
            content: '';
            position: absolute;
            inset: 12%;
            border-radius: 50%;
            transform: scale(0);
            transition: transform 0.15s ease-out;
        }
        .gk-cell.s0::after {
            background: radial-gradient(circle at 35% 35%, #555, #000 70%);
            transform: scale(1);
            box-shadow: 0 1px 2px rgba(0,0,0,0.6);
        }
        .gk-cell.s1::after {
            background: radial-gradient(circle at 35% 35%, #fff, #cfcfcf 70%);
            transform: scale(1);
            box-shadow: 0 1px 2px rgba(0,0,0,0.6);
        }
        .gk-cell.last::after {
            outline: 2px solid var(--secondary-color);
            outline-offset: 1px;
        }
        .gk-cell.playable:active::after {
            transform: scale(0.8);
            background: rgba(255,255,255,0.35);
        }
        .gk-legend {
            display: flex;
            gap: 18px;
            justify-content: center;
            align-items: center;
            font-size: 0.9rem;
            flex-wrap: wrap;
        }
        .gk-dot {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: inline-block;
            vertical-align: middle;
            margin-right: 5px;
            border: 1px solid #666;
        }
        .gk-you {
            font-weight: bold;
            color: var(--secondary-color);
        }
        .gk-meta {
            font-size: 0.8rem;
            color: #aaa;
        }
        @media (hover: hover) {
            .gk-cell.playable:hover::after {
                transform: scale(0.7);
                background: rgba(255,255,255,0.35);
            }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="gk-wrap">
            <div class="gk-info">Get five stones in a row (any direction) to win. Black moves first.</div>
            <div class="gk-legend">
                <span><span class="gk-dot" style="background:#111"></span>Black (Player 1)</span>
                <span><span class="gk-dot" style="background:#eee"></span>White (Player 2)</span>
            </div>
            <div class="gk-you" id="gk-you"></div>
            <div class="gk-board" id="gk-board"></div>
            <div class="gk-meta" id="gk-meta"></div>
        </div>
    `;

    const boardEl = document.getElementById('gk-board');
    const statusEl = document.getElementById('game-status');
    const youEl = document.getElementById('gk-you');
    const metaEl = document.getElementById('gk-meta');
    const myIdx = playerIndex;
    let lastState = initialState || null;

    youEl.textContent = 'You are ' + (myIdx === 0 ? 'Black' : 'White');

    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'gk-cell r' + r + ' c' + c;
            cell.addEventListener('click', () => {
                if (!canAct(lastState, myIdx)) return;
                if (lastState && lastState.board[r][c] !== null) return;
                socket.emit('make_move', { roomId, move: { row: r, col: c } });
            });
            boardEl.appendChild(cell);
        }
    }

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => { if (typeof showToast === 'function') showToast(msg); else alert(msg); });

    if (initialState) render(initialState);

    function render(state) {
        lastState = state;
        const { board, lastMove, activePlayerIndex, isGameOver, winner } = state;
        const myTurn = !isGameOver && activePlayerIndex === myIdx;

        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                const cell = boardEl.children[r * SIZE + c];
                const val = board[r][c];
                cell.className = 'gk-cell r' + r + ' c' + c;
                if (val === 0 || val === 1) cell.classList.add('s' + val);
                else if (myTurn) cell.classList.add('playable');
                if (lastMove && lastMove.row === r && lastMove.col === c) cell.classList.add('last');
            }
        }

        let black = 0, white = 0;
        for (const row of board) for (const v of row) { if (v === 0) black++; else if (v === 1) white++; }
        metaEl.textContent = 'Stones: Black ' + black + ' | White ' + white +
            (lastMove ? ' | Last: ' + String.fromCharCode(65 + lastMove.col) + (lastMove.row + 1) : '');

        if (isGameOver) {
            const msg = winner === 'draw' ? "It's a Draw!" : (winner === myIdx ? 'You Won!' : 'You Lost!');
            statusEl.textContent = msg;
            statusEl.style.color = '';
            showStatus(msg);
        } else {
            statusEl.textContent = myTurn ? 'Your Turn' : "Opponent's Turn";
            statusEl.style.color = myTurn ? '#4caf50' : '#fff';
        }
    }
}
