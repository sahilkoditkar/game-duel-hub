function initBingo(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('bingo-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'bingo-styles';
    style.innerHTML = `
        .bingo-board {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 5px;
            margin: 20px auto;
            max-width: 350px;
            width: 100%;
        }
        .bingo-cell {
            aspect-ratio: 1;
            background: #333;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: clamp(0.9rem, 3vw, 1.2rem);
            cursor: pointer;
            border-radius: 4px;
            user-select: none;
            color: #fff;
            transition: background 0.3s, transform 0.2s;
            touch-action: manipulation;
        }
        .bingo-cell.marked {
            background: var(--primary-color);
            color: #000;
            font-weight: bold;
            animation: cellPop 0.3s ease-out;
        }
        .bingo-cell:active:not(.marked) {
            transform: scale(0.95);
        }
        .bingo-letters {
            display: flex;
            justify-content: center;
            gap: 10px;
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 10px;
            color: #555;
        }
        .bingo-letter.active {
            color: var(--primary-color);
            text-shadow: 0 0 10px var(--primary-color);
        }
        @media (hover: hover) {
            .bingo-cell:hover:not(.marked) {
                background: #444;
            }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="bingo-letters" id="p1-letters">
            <span id="L-B">B</span>
            <span id="L-I">I</span>
            <span id="L-N">N</span>
            <span id="L-G">G</span>
            <span id="L-O">O</span>
        </div>
        <div class="bingo-board" id="bingo-board"></div>
        <div id="opp-score" style="margin-top:10px; font-size: 0.9rem; color: #888;">
            Opponent Lines: <span id="opp-lines">0</span>
        </div>
    `;

    const boardEl = document.getElementById('bingo-board');
    const statusEl = document.getElementById('game-status');
    const oppLinesEl = document.getElementById('opp-lines');
    const myIdx = playerIndex;
    const letters = ['B', 'I', 'N', 'G', 'O'];

    // Cleanup
    socket.off('game_state');
    socket.off('invalid_move');

    socket.on('game_state', (data) => render(data));
    socket.on('invalid_move', (msg) => { if (typeof showToast === 'function') showToast(msg); else alert(msg); });

    let boardRendered = false;
    let lastState = initialState || null;
    let latestSelected = new Set();

    // Render immediately if state provided
    if (initialState) {
        render(initialState);
    }

    function render(state) {
        const { boards, selectedNumbers, scores, activePlayerIndex, isGameOver, winner } = state;
        lastState = state;
        const myBoard = boards[myIdx];
        const selectedSet = new Set(selectedNumbers);
        latestSelected = selectedSet;

        // Render board if not already
        if (!boardRendered && myBoard) {
            boardEl.innerHTML = '';
            myBoard.forEach((row, r) => {
                row.forEach((num, c) => {
                    const cell = document.createElement('div');
                    cell.className = 'bingo-cell';
                    cell.textContent = num;
                    cell.dataset.num = num;
                    cell.addEventListener('click', () => {
                        if (!canAct(lastState, myIdx)) return;
                        if (latestSelected.has(num)) return;
                        socket.emit('make_move', { roomId, move: { number: num } });
                    });
                    boardEl.appendChild(cell);
                });
            });
            boardRendered = true;
        }

        // Update marked cells
        if (boardRendered) {
            document.querySelectorAll('.bingo-cell').forEach(cell => {
                const num = parseInt(cell.dataset.num);
                if (selectedSet.has(num)) {
                    cell.classList.add('marked');
                }
            });
        }

        // Update BINGO letters
        const myLines = scores[myIdx];
        letters.forEach((l, i) => {
            const el = document.getElementById(`L-${l}`);
            if (i < myLines) el.classList.add('active');
        });

        // Update opponent score
        oppLinesEl.textContent = scores[1 - myIdx];

        // Status
        if (isGameOver) {
            if (winner === 'draw') {
                const msg = "It's a Draw!";
                statusEl.textContent = msg;
                showStatus(msg);
            } else {
                const msg = winner === myIdx ? "BINGO! You Won!" : "You Lost! Opponent got BINGO!";
                statusEl.textContent = msg;
                showStatus(msg);
            }
        } else {
            statusEl.textContent = activePlayerIndex === myIdx ? "Your Turn" : "Opponent's Turn";
            statusEl.style.color = activePlayerIndex === myIdx ? "#4caf50" : "#fff";
        }
    }
}
