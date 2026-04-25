function initReversi(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('reversi-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'reversi-styles';
    style.innerHTML = `
        .rv-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            width: 100%;
            user-select: none;
        }
        .rv-board {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            gap: 2px;
            background: #000;
            border: 2px solid #555;
            width: 100%;
            max-width: min(90vw, 400px);
            aspect-ratio: 1;
        }
        .rv-cell {
            background: #2d6a2d;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: default;
            position: relative;
            touch-action: manipulation;
        }
        .rv-cell.valid {
            cursor: pointer;
        }
        .rv-cell.valid::after {
            content: '';
            width: 30%;
            height: 30%;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
        }
        .rv-cell:active.valid {
            background: #3a8a3a;
        }
        .rv-disc {
            width: 80%;
            height: 80%;
            border-radius: 50%;
            transition: background 0.3s;
            animation: cellPop 0.3s ease-out;
        }
        .rv-disc.p0 {
            background: #222;
            border: 2px solid #000;
        }
        .rv-disc.p1 {
            background: #f0f0f0;
            border: 2px solid #ccc;
        }
        .rv-scores {
            display: flex;
            gap: 30px;
            font-size: 1.1rem;
            font-weight: bold;
        }
        .rv-score-black {
            color: #aaa;
        }
        .rv-score-black::before {
            content: '';
            display: inline-block;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #333;
            border: 1px solid #666;
            margin-right: 6px;
            vertical-align: middle;
        }
        .rv-score-white {
            color: #fff;
        }
        .rv-score-white::before {
            content: '';
            display: inline-block;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #f0f0f0;
            margin-right: 6px;
            vertical-align: middle;
        }
        @media (hover: hover) {
            .rv-cell.valid:hover {
                background: #3a8a3a;
            }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="rv-container">
            <div class="rv-scores">
                <span class="rv-score-black">Black: <span id="rv-count0">2</span></span>
                <span class="rv-score-white">White: <span id="rv-count1">2</span></span>
            </div>
            <div class="rv-board" id="rv-board"></div>
        </div>
    `;

    const boardEl = document.getElementById('rv-board');
    const statusEl = document.getElementById('game-status');
    const count0El = document.getElementById('rv-count0');
    const count1El = document.getElementById('rv-count1');
    const myIdx = playerIndex;

    // Create 64 cells
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.className = 'rv-cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => {
                socket.emit('make_move', { roomId, move: { row: r, col: c } });
            });
            boardEl.appendChild(cell);
        }
    }

    socket.off('game_state');
    socket.off('invalid_move');

    socket.on('game_state', (data) => render(data));
    socket.on('invalid_move', (msg) => alert(msg));

    if (initialState) render(initialState);

    function render(state) {
        const { board, validMoves, activePlayerIndex, isGameOver, winner, finalScores } = state;

        const validSet = new Set(validMoves.map(([r, c]) => `${r},${c}`));

        let count0 = 0,
            count1 = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const cell = boardEl.children[r * 8 + c];
                cell.className = 'rv-cell';
                cell.innerHTML = '';

                const val = board[r][c];
                if (val !== null) {
                    const disc = document.createElement('div');
                    disc.className = `rv-disc p${val}`;
                    cell.appendChild(disc);
                    if (val === 0) count0++;
                    else count1++;
                }

                // Show valid moves for current player
                if (!isGameOver && activePlayerIndex === myIdx && validSet.has(`${r},${c}`)) {
                    cell.classList.add('valid');
                }
            }
        }

        count0El.textContent = finalScores ? finalScores[0] : count0;
        count1El.textContent = finalScores ? finalScores[1] : count1;

        if (isGameOver) {
            if (winner === 'draw') {
                statusEl.textContent = "It's a Draw!";
                showStatus("It's a Draw!");
            } else {
                const msg = winner === myIdx ? 'You Won!' : 'You Lost!';
                statusEl.textContent = msg;
                showStatus(msg);
            }
        } else {
            const roleLabel = myIdx === 0 ? 'Black' : 'White';
            statusEl.textContent =
                activePlayerIndex === myIdx ? `Your Turn (${roleLabel})` : "Opponent's Turn";
            statusEl.style.color = activePlayerIndex === myIdx ? '#4caf50' : '#fff';
        }
    }
}
