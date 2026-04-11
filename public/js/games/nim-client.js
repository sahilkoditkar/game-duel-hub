function initNim(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('nim-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'nim-styles';
    style.innerHTML = `
        .nim-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            width: 100%;
            max-width: 400px;
            margin: 0 auto;
            user-select: none;
        }
        .nim-row {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            width: 100%;
            background: #222;
            padding: 12px;
            border-radius: 8px;
        }
        .nim-row-label {
            font-size: 0.8rem;
            color: #888;
        }
        .nim-stones {
            display: flex;
            gap: clamp(6px, 2vw, 10px);
            justify-content: center;
            flex-wrap: wrap;
        }
        .nim-stone {
            width: clamp(36px, 9vw, 48px);
            height: clamp(36px, 9vw, 48px);
            border-radius: 50%;
            background: var(--primary-color);
            cursor: pointer;
            transition: background 0.2s, transform 0.15s, opacity 0.3s;
            touch-action: manipulation;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .nim-stone.selected {
            background: #ef4444;
            transform: scale(1.1);
        }
        .nim-stone.removed {
            opacity: 0.15;
            cursor: default;
            background: #333;
        }
        .nim-stone:active:not(.removed) {
            transform: scale(0.9);
        }
        .nim-controls {
            display: flex;
            gap: 10px;
            width: 100%;
        }
        .nim-btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.1s;
            touch-action: manipulation;
        }
        .nim-btn:active { transform: scale(0.97); }
        .nim-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .nim-btn.confirm { background: var(--secondary-color); color: #000; }
        .nim-btn.clear { background: #555; color: #fff; }
        .nim-info {
            font-size: 0.85rem;
            color: #888;
            text-align: center;
        }
        @media (hover: hover) {
            .nim-stone:hover:not(.removed):not(.selected) {
                background: #9b6fd4;
            }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="nim-container">
            <div class="nim-info">Select stones from one row, then confirm. Last to take loses!</div>
            <div id="nim-rows"></div>
            <div class="nim-controls">
                <button class="nim-btn clear" id="nim-clear" disabled>Clear</button>
                <button class="nim-btn confirm" id="nim-confirm" disabled>Take Stones</button>
            </div>
        </div>
    `;

    const rowsContainer = document.getElementById('nim-rows');
    const statusEl = document.getElementById('game-status');
    const confirmBtn = document.getElementById('nim-confirm');
    const clearBtn = document.getElementById('nim-clear');
    const myIdx = playerIndex;

    let selectedRow = -1;
    let selectedCount = 0;
    let currentRows = [1, 3, 5, 7];

    confirmBtn.addEventListener('click', () => {
        if (selectedRow === -1 || selectedCount === 0) return;
        socket.emit('make_move', { roomId, move: { row: selectedRow, count: selectedCount } });
        selectedRow = -1;
        selectedCount = 0;
    });

    clearBtn.addEventListener('click', () => {
        selectedRow = -1;
        selectedCount = 0;
        renderBoard();
    });

    socket.off('game_state');
    socket.off('invalid_move');

    socket.on('game_state', (data) => render(data));
    socket.on('invalid_move', (msg) => {
        alert(msg);
        selectedRow = -1;
        selectedCount = 0;
        renderBoard();
    });

    if (initialState) render(initialState);

    function render(state) {
        currentRows = state.rows;
        selectedRow = -1;
        selectedCount = 0;

        if (state.isGameOver) {
            if (state.winner === 'draw') {
                statusEl.textContent = "It's a Draw!";
                showStatus("It's a Draw!");
            } else {
                const msg = state.winner === myIdx ? "You Won!" : "You Lost!";
                statusEl.textContent = msg;
                showStatus(msg);
            }
            confirmBtn.disabled = true;
            clearBtn.disabled = true;
        } else {
            statusEl.textContent = state.activePlayerIndex === myIdx ? "Your Turn" : "Opponent's Turn";
            statusEl.style.color = state.activePlayerIndex === myIdx ? "#4caf50" : "#fff";
        }

        renderBoard();
    }

    function renderBoard() {
        rowsContainer.innerHTML = '';
        const maxStones = [1, 3, 5, 7]; // Original counts for tracking removed

        currentRows.forEach((count, rowIdx) => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'nim-row';

            const label = document.createElement('div');
            label.className = 'nim-row-label';
            label.textContent = `Row ${rowIdx + 1}`;
            rowDiv.appendChild(label);

            const stonesDiv = document.createElement('div');
            stonesDiv.className = 'nim-stones';

            const originalCount = maxStones[rowIdx];

            for (let i = 0; i < originalCount; i++) {
                const stone = document.createElement('div');
                stone.className = 'nim-stone';

                if (i >= count) {
                    // This stone has been removed
                    stone.classList.add('removed');
                } else if (selectedRow === rowIdx && i >= (count - selectedCount)) {
                    // This stone is selected for removal
                    stone.classList.add('selected');
                }

                if (i < count && !stone.classList.contains('removed')) {
                    stone.addEventListener('click', () => {
                        handleStoneClick(rowIdx, i, count);
                    });
                }

                stonesDiv.appendChild(stone);
            }

            rowDiv.appendChild(stonesDiv);
            rowsContainer.appendChild(rowDiv);
        });

        confirmBtn.disabled = selectedCount === 0;
        clearBtn.disabled = selectedCount === 0;
    }

    function handleStoneClick(rowIdx, stoneIdx, rowCount) {
        if (selectedRow !== -1 && selectedRow !== rowIdx) {
            // Switch to new row
            selectedRow = rowIdx;
            selectedCount = 0;
        }

        selectedRow = rowIdx;
        // Select from this stone to the end
        selectedCount = rowCount - stoneIdx;
        renderBoard();
    }
}
