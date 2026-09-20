function initConnectFour(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('connectfour-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'connectfour-styles';
    style.innerHTML = `
        .cf-board {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: clamp(3px, 1vw, 6px);
            margin: 20px auto;
            max-width: min(95vw, 420px);
            width: 100%;
            background: #1a3a8a;
            padding: clamp(6px, 2vw, 12px);
            border-radius: 12px;
        }
        .cf-cell {
            aspect-ratio: 1;
            background: #222;
            border-radius: 50%;
            cursor: pointer;
            transition: background 0.2s, transform 0.15s;
            touch-action: manipulation;
            user-select: none;
        }
        .cf-cell:active {
            transform: scale(0.9);
        }
        .cf-cell.R {
            background: #ef4444;
            animation: cellPop 0.3s ease-out;
        }
        .cf-cell.Y {
            background: #facc15;
            animation: cellPop 0.3s ease-out;
        }
        .cf-col-indicator {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: clamp(3px, 1vw, 6px);
            max-width: min(95vw, 420px);
            width: 100%;
            margin: 0 auto 5px;
            padding: 0 clamp(6px, 2vw, 12px);
        }
        .cf-col-btn {
            text-align: center;
            font-size: clamp(1rem, 3vw, 1.5rem);
            color: #555;
            cursor: pointer;
            padding: 4px;
            touch-action: manipulation;
        }
        .cf-col-btn.active {
            color: var(--secondary-color);
        }
        .cf-legend {
            display: flex;
            gap: 20px;
            justify-content: center;
            margin-top: 10px;
            font-size: 0.9rem;
        }
        .cf-legend-dot {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: inline-block;
            vertical-align: middle;
            margin-right: 5px;
        }
        @media (hover: hover) {
            .cf-cell:hover {
                opacity: 0.8;
            }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="cf-col-indicator" id="cf-indicators"></div>
        <div class="cf-board" id="cf-board"></div>
        <div class="cf-legend">
            <span><span class="cf-legend-dot" style="background:#ef4444"></span>Player 1</span>
            <span><span class="cf-legend-dot" style="background:#facc15"></span>Player 2</span>
        </div>
    `;

    const boardEl = document.getElementById('cf-board');
    const indicatorEl = document.getElementById('cf-indicators');
    const statusEl = document.getElementById('game-status');
    const myIdx = playerIndex;
    let lastState = initialState || null;

    // Create column indicators
    for (let c = 0; c < 7; c++) {
        const ind = document.createElement('div');
        ind.className = 'cf-col-btn';
        ind.textContent = '\u25BC';
        ind.addEventListener('click', () => {
            if (!canAct(lastState, myIdx)) return;
            socket.emit('make_move', { roomId, move: { col: c } });
        });
        indicatorEl.appendChild(ind);
    }

    // Create board cells (6 rows x 7 cols)
    for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 7; c++) {
            const cell = document.createElement('div');
            cell.className = 'cf-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => {
                if (!canAct(lastState, myIdx)) return;
            socket.emit('make_move', { roomId, move: { col: c } });
            });
            boardEl.appendChild(cell);
        }
    }

    socket.off('game_state');
    socket.off('invalid_move');

    socket.on('game_state', (data) => render(data));
    socket.on('invalid_move', (msg) => { if (typeof showToast === 'function') showToast(msg); else alert(msg); });

    if (initialState) render(initialState);

    function render(state) {
        lastState = state;
        const { board, activePlayerIndex, isGameOver, winner } = state;

        // Update board
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 7; c++) {
                const cell = boardEl.children[r * 7 + c];
                const val = board[r][c];
                cell.className = 'cf-cell';
                if (val) cell.classList.add(val);
            }
        }

        // Update column indicators
        const indicators = indicatorEl.children;
        for (let c = 0; c < 7; c++) {
            indicators[c].className = 'cf-col-btn';
            if (!isGameOver && activePlayerIndex === myIdx && board[0][c] === null) {
                indicators[c].classList.add('active');
            }
        }

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
            statusEl.textContent = activePlayerIndex === myIdx ? "Your Turn" : "Opponent's Turn";
            statusEl.style.color = activePlayerIndex === myIdx ? "#4caf50" : "#fff";
        }
    }
}
