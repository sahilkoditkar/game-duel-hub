function initCheckers(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('checkers-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'checkers-styles';
    style.innerHTML = `
        .ck-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            width: 100%;
            user-select: none;
        }
        .ck-board {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            gap: 0;
            border: 3px solid #555;
            width: 100%;
            max-width: min(90vw, 400px);
            aspect-ratio: 1;
        }
        .ck-cell {
            aspect-ratio: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            touch-action: manipulation;
        }
        .ck-cell.light { background: #d4a76a; }
        .ck-cell.dark { background: #8b5e3c; }
        .ck-cell.selected { background: #5a9e5a !important; }
        .ck-cell.valid-target {
            cursor: pointer;
        }
        .ck-cell.valid-target::after {
            content: '';
            width: 35%;
            height: 35%;
            border-radius: 50%;
            background: rgba(76, 175, 80, 0.6);
            position: absolute;
        }
        .ck-cell.valid-source {
            cursor: pointer;
        }
        .ck-piece {
            width: 75%;
            height: 75%;
            border-radius: 50%;
            cursor: pointer;
            transition: transform 0.15s;
            position: relative;
            touch-action: manipulation;
        }
        .ck-piece:active {
            transform: scale(0.9);
        }
        .ck-piece.p0 {
            background: radial-gradient(circle at 35% 35%, #555, #111);
            border: 2px solid #333;
        }
        .ck-piece.p1 {
            background: radial-gradient(circle at 35% 35%, #fff, #ccc);
            border: 2px solid #aaa;
        }
        .ck-piece.king::after {
            content: '\u265A';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: clamp(0.7rem, 2.5vw, 1.2rem);
        }
        .ck-piece.p0.king::after { color: #ffd700; }
        .ck-piece.p1.king::after { color: #b8860b; }
        .ck-info {
            font-size: 0.85rem;
            color: #888;
            text-align: center;
        }
        .ck-counts {
            display: flex;
            gap: 20px;
            font-weight: bold;
        }
        @media (hover: hover) {
            .ck-cell.valid-target:hover { background: #4a8e4a !important; }
            .ck-cell.valid-source:hover { background: #5a8a5a !important; }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="ck-container">
            <div class="ck-counts">
                <span style="color:#aaa">Black: <span id="ck-c0">12</span></span>
                <span style="color:#fff">White: <span id="ck-c1">12</span></span>
            </div>
            <div class="ck-board" id="ck-board"></div>
            <div class="ck-info">Tap a piece, then tap where to move. Captures are mandatory!</div>
        </div>
    `;

    const boardEl = document.getElementById('ck-board');
    const statusEl = document.getElementById('game-status');
    const c0El = document.getElementById('ck-c0');
    const c1El = document.getElementById('ck-c1');
    const myIdx = playerIndex;

    let selectedPiece = null; // { row, col }
    let currentState = null;

    // Create 64 cells
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.className = 'ck-cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.addEventListener('click', () => handleClick(r, c));
            boardEl.appendChild(cell);
        }
    }

    socket.off('game_state');
    socket.off('invalid_move');

    socket.on('game_state', (data) => {
        currentState = data;
        selectedPiece = null;
        render(data);
    });
    socket.on('invalid_move', (msg) => {
        alert(msg);
        selectedPiece = null;
        if (currentState) render(currentState);
    });

    if (initialState) {
        currentState = initialState;
        render(initialState);
    }

    function handleClick(row, col) {
        if (!currentState || currentState.isGameOver) return;
        if (currentState.activePlayerIndex !== myIdx) return;

        const board = currentState.board;
        const piece = board[row][col];

        if (selectedPiece) {
            // Check if clicking on own piece to re-select
            if (piece && piece.player === myIdx) {
                // Only re-select if not forced to continue with specific piece
                if (!currentState.mustContinue) {
                    selectedPiece = { row, col };
                    render(currentState);
                    return;
                }
            }

            // Try to move
            socket.emit('make_move', {
                roomId,
                move: {
                    fromRow: selectedPiece.row,
                    fromCol: selectedPiece.col,
                    toRow: row,
                    toCol: col
                }
            });
        } else {
            // Select a piece
            if (piece && piece.player === myIdx) {
                // If must continue, only allow selecting that piece
                if (currentState.mustContinue) {
                    if (row === currentState.mustContinue.row && col === currentState.mustContinue.col) {
                        selectedPiece = { row, col };
                        render(currentState);
                    }
                } else {
                    selectedPiece = { row, col };
                    render(currentState);
                }
            }
        }
    }

    function render(state) {
        const { board, validMoves, mustContinue, activePlayerIndex, isGameOver, winner } = state;

        // Build valid move maps
        const validTargets = new Set();
        const validSources = new Set();
        if (!isGameOver && activePlayerIndex === myIdx) {
            validMoves.forEach(m => {
                validSources.add(`${m.fromRow},${m.fromCol}`);
                if (selectedPiece && m.fromRow === selectedPiece.row && m.fromCol === selectedPiece.col) {
                    validTargets.add(`${m.toRow},${m.toCol}`);
                }
            });
        }

        let count0 = 0, count1 = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const cell = boardEl.children[r * 8 + c];
                cell.className = 'ck-cell ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
                cell.innerHTML = '';

                const piece = board[r][c];
                if (piece) {
                    const pieceEl = document.createElement('div');
                    pieceEl.className = `ck-piece p${piece.player}`;
                    if (piece.king) pieceEl.classList.add('king');
                    cell.appendChild(pieceEl);

                    if (piece.player === 0) count0++;
                    else count1++;
                }

                // Highlight
                if (selectedPiece && selectedPiece.row === r && selectedPiece.col === c) {
                    cell.classList.add('selected');
                }
                if (validTargets.has(`${r},${c}`)) {
                    cell.classList.add('valid-target');
                }
                if (!selectedPiece && validSources.has(`${r},${c}`)) {
                    cell.classList.add('valid-source');
                }
            }
        }

        c0El.textContent = count0;
        c1El.textContent = count1;

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
            const roleLabel = myIdx === 0 ? 'Black' : 'White';
            statusEl.textContent = activePlayerIndex === myIdx
                ? (mustContinue ? "Continue jumping!" : `Your Turn (${roleLabel})`)
                : "Opponent's Turn";
            statusEl.style.color = activePlayerIndex === myIdx ? "#4caf50" : "#fff";
        }
    }
}
