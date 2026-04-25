function initTicTacToe(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('tictactoe-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'tictactoe-styles';
    style.innerHTML = `
        .ttt-board {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin: 20px auto;
            max-width: 350px;
            width: 100%;
        }
        .ttt-cell {
            aspect-ratio: 1;
            background: #333;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: clamp(2rem, 5vw, 3rem);
            cursor: pointer;
            border-radius: 8px;
            user-select: none;
            touch-action: manipulation;
            transition: background 0.15s, transform 0.15s;
        }
        .ttt-cell:active {
            transform: scale(0.95);
        }
        @media (hover: hover) {
            .ttt-cell:hover {
                background: #444;
            }
        }
        @media (hover: none) {
            .ttt-cell:active {
                background: #444;
            }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="ttt-board" id="board"></div>
    `;

    const boardEl = document.getElementById('board');
    const statusEl = document.getElementById('game-status');
    const myPlayerIndex = playerIndex;
    console.log('Initialized as player ' + myPlayerIndex);

    // Create cells
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'ttt-cell';
        cell.dataset.index = i;
        cell.addEventListener('click', () => {
            socket.emit('make_move', { roomId, move: { index: i } });
        });
        boardEl.appendChild(cell);
    }

    // CLEANUP OLD LISTENERS FIRST to prevent duplicates
    socket.off('game_state');
    socket.off('invalid_move');

    // Add new listeners
    socket.on('game_state', (data) => {
        render(data);
    });

    socket.on('invalid_move', (msg) => {
        alert(msg);
    });

    if (initialState) {
        render(initialState);
    }

    function render(state) {
        const { gameState, activePlayerIndex, isGameOver, winner } = state;
        const board = gameState.board;

        // Update board
        board.forEach((symbol, i) => {
            const cell = boardEl.children[i];
            cell.textContent = symbol || '';
        });

        // Update Status
        if (isGameOver) {
            if (winner === 'draw') {
                statusEl.textContent = "It's a Draw!";
                showStatus("It's a Draw!");
            } else {
                const msg = winner === myPlayerIndex ? 'You Won!' : 'You Lost!';
                statusEl.textContent = msg;
                showStatus(msg);
            }
        } else {
            statusEl.textContent =
                activePlayerIndex === myPlayerIndex ? 'Your Turn' : "Opponent's Turn";
        }
    }
}
