function initUltimateTtt(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('ultimatettt-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'ultimatettt-styles';
    style.textContent = `
        .ut-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: 100%;
            max-width: 420px;
            margin: 0 auto;
            user-select: none;
        }
        .ut-info {
            font-size: 0.85rem;
            color: #888;
            text-align: center;
        }
        .ut-legend {
            display: flex;
            gap: 18px;
            justify-content: center;
            font-size: 0.9rem;
            flex-wrap: wrap;
        }
        .ut-x { color: #ef4444; font-weight: bold; }
        .ut-o { color: #3b82f6; font-weight: bold; }
        .ut-you { font-weight: bold; color: var(--secondary-color); }
        .ut-big {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: clamp(5px, 1.6vw, 8px);
            width: 100%;
            max-width: min(92vw, 400px);
            aspect-ratio: 1;
            background: #555;
            padding: clamp(5px, 1.6vw, 8px);
            border-radius: 10px;
            box-sizing: border-box;
            touch-action: manipulation;
        }
        .ut-small {
            position: relative;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2px;
            background: #222;
            padding: 2px;
            border-radius: 6px;
            border: 2px solid transparent;
            transition: border-color 0.2s, background 0.2s;
        }
        .ut-small.active {
            border-color: var(--secondary-color);
            box-shadow: 0 0 8px rgba(3, 218, 198, 0.5);
        }
        .ut-small.won-0 { background: rgba(239, 68, 68, 0.25); }
        .ut-small.won-1 { background: rgba(59, 130, 246, 0.25); }
        .ut-small.won-draw { background: #3a3a3a; }
        .ut-cell {
            aspect-ratio: 1;
            background: #333;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: clamp(0.8rem, 3.2vw, 1.3rem);
            font-weight: bold;
            line-height: 1;
            cursor: pointer;
            touch-action: manipulation;
            transition: background 0.15s;
        }
        .ut-cell.p0 { color: #ef4444; }
        .ut-cell.p1 { color: #3b82f6; }
        .ut-cell.last { background: #4a4a2a; box-shadow: inset 0 0 0 2px var(--secondary-color); }
        .ut-cell.playable:active { background: #444; }
        .ut-small.won-0 .ut-cell, .ut-small.won-1 .ut-cell, .ut-small.won-draw .ut-cell { opacity: 0.35; cursor: default; }
        .ut-overlay {
            position: absolute;
            inset: 0;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: clamp(2rem, 11vw, 4.5rem);
            font-weight: bold;
            line-height: 1;
            pointer-events: none;
            text-shadow: 0 2px 6px rgba(0,0,0,0.8);
        }
        .ut-small.won-0 .ut-overlay, .ut-small.won-1 .ut-overlay, .ut-small.won-draw .ut-overlay { display: flex; }
        .ut-small.won-0 .ut-overlay { color: #ef4444; }
        .ut-small.won-1 .ut-overlay { color: #3b82f6; }
        .ut-small.won-draw .ut-overlay { color: #999; font-size: clamp(1.2rem, 6vw, 2.2rem); }
        .ut-meta { font-size: 0.85rem; color: #aaa; text-align: center; }
        @media (hover: hover) {
            .ut-cell.playable:hover { background: #444; }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="ut-wrap">
            <div class="ut-info">Win 3 small boards in a row. The cell you pick sends your opponent to that board.</div>
            <div class="ut-legend">
                <span><span class="ut-x">X</span> Player 1</span>
                <span><span class="ut-o">O</span> Player 2</span>
                <span class="ut-you" id="ut-you"></span>
            </div>
            <div class="ut-big" id="ut-big"></div>
            <div class="ut-meta" id="ut-meta"></div>
        </div>
    `;

    const bigEl = document.getElementById('ut-big');
    const statusEl = document.getElementById('game-status');
    const metaEl = document.getElementById('ut-meta');
    const myIdx = playerIndex;
    const MARK = ['X', 'O'];
    let lastState = initialState || null;

    document.getElementById('ut-you').textContent = 'You are ' + MARK[myIdx];

    const smallEls = [];
    for (let b = 0; b < 9; b++) {
        const small = document.createElement('div');
        small.className = 'ut-small';
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'ut-cell';
            cell.addEventListener('click', () => {
                if (!canAct(lastState, myIdx)) return;
                if (lastState) {
                    if (lastState.boardWinners[b] !== null) return;
                    if (lastState.nextBoard !== null && lastState.nextBoard !== b) return;
                    if (lastState.boards[b][c] !== null) return;
                }
                socket.emit('make_move', { roomId, move: { board: b, cell: c } });
            });
            small.appendChild(cell);
        }
        const overlay = document.createElement('div');
        overlay.className = 'ut-overlay';
        small.appendChild(overlay);
        bigEl.appendChild(small);
        smallEls.push(small);
    }

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => { if (typeof showToast === 'function') showToast(msg); else alert(msg); });

    if (initialState) render(initialState);

    function render(state) {
        lastState = state;
        const { boards, boardWinners, nextBoard, lastMove, activePlayerIndex, isGameOver, winner } = state;
        const myTurn = !isGameOver && activePlayerIndex === myIdx;

        for (let b = 0; b < 9; b++) {
            const small = smallEls[b];
            const w = boardWinners[b];
            const open = w === null && (nextBoard === null || nextBoard === b);
            small.className = 'ut-small';
            if (w !== null) small.classList.add('won-' + w);
            if (!isGameOver && open) small.classList.add('active');
            const overlay = small.children[9];
            overlay.textContent = w === 0 || w === 1 ? MARK[w] : (w === 'draw' ? 'tie' : '');
            for (let c = 0; c < 9; c++) {
                const cell = small.children[c];
                const v = boards[b][c];
                cell.className = 'ut-cell';
                cell.textContent = v === 0 || v === 1 ? MARK[v] : '';
                if (v === 0 || v === 1) cell.classList.add('p' + v);
                else if (myTurn && open) cell.classList.add('playable');
                if (lastMove && lastMove.board === b && lastMove.cell === c) cell.classList.add('last');
            }
        }

        const owned = [0, 0];
        for (const w of boardWinners) { if (w === 0 || w === 1) owned[w]++; }
        let hint = 'Boards won: X ' + owned[0] + ' | O ' + owned[1];
        if (!isGameOver) {
            hint += nextBoard === null ? ' | Play in any open board' : ' | Play in the highlighted board';
        }
        metaEl.textContent = hint;

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
