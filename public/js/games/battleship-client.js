function initBattleship(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('battleship-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'battleship-styles';
    style.innerHTML = `
        .bs-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
            align-items: center;
            width: 100%;
            user-select: none;
        }
        .bs-grid-container {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .bs-grid-title {
            font-weight: bold;
            margin-bottom: 5px;
            color: #aaa;
        }
        .bs-grid {
            display: grid;
            grid-template-columns: repeat(10, 1fr);
            gap: 2px;
            background: #000;
            border: 2px solid #555;
            width: 100%;
            max-width: min(95vw, 350px);
            aspect-ratio: 1;
        }
        .bs-cell {
            background: #0c4a6e; /* Deep blue water */
            width: 100%;
            height: 100%;
            cursor: default;
            transition: background 0.2s;
            touch-action: manipulation;
            position: relative;
        }

        /* Interactive Target Grid */
        .target-grid .bs-cell { cursor: pointer; }

        /* Cell States - distinct colors */
        .bs-cell.ship {
            background: #64748b; /* Gray ship */
            border: 1px solid #94a3b8;
        }
        .bs-cell.hit {
            background: #dc2626; /* Bright red */
            animation: cellPop 0.3s ease-out;
        }
        .bs-cell.hit::after {
            content: '\u2716'; /* X mark */
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #fff;
            font-size: clamp(0.6rem, 2vw, 1rem);
            font-weight: bold;
        }
        .bs-cell.miss {
            background: #93c5fd; /* Light cyan/blue */
            animation: fadeIn 0.3s;
        }
        .bs-cell.miss::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 30%;
            height: 30%;
            background: #fff;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            opacity: 0.85;
        }

        @media (hover: hover) {
            .target-grid .bs-cell:hover:not(.hit):not(.miss) { background: #155e8a; }
        }

        .target-grid .bs-cell:active:not(.hit):not(.miss) { background: #1e7ba8; }

        .bs-legend {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
            font-size: 0.75rem;
            color: #94a3b8;
            margin-top: 8px;
        }
        .bs-legend-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .bs-legend-swatch {
            width: 14px;
            height: 14px;
            border-radius: 2px;
            border: 1px solid #555;
        }

        @media (min-width: 768px) {
            .bs-container {
                flex-direction: row;
                justify-content: center;
                align-items: flex-start;
            }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="bs-container">
            <div class="bs-grid-container">
                <div class="bs-grid-title">Target Grid (Fire Here)</div>
                <div id="target-grid" class="bs-grid target-grid"></div>
            </div>

            <div class="bs-grid-container">
                <div class="bs-grid-title">My Ships</div>
                <div id="my-grid" class="bs-grid"></div>
            </div>

            <div class="bs-legend">
                <div class="bs-legend-item"><span class="bs-legend-swatch" style="background:#0c4a6e"></span>Water</div>
                <div class="bs-legend-item"><span class="bs-legend-swatch" style="background:#64748b"></span>Ship</div>
                <div class="bs-legend-item"><span class="bs-legend-swatch" style="background:#dc2626"></span>Hit</div>
                <div class="bs-legend-item"><span class="bs-legend-swatch" style="background:#93c5fd"></span>Miss</div>
            </div>
        </div>
    `;

    const targetEl = document.getElementById('target-grid');
    const myEl = document.getElementById('my-grid');
    const statusEl = document.getElementById('game-status');
    const myIdx = playerIndex;
    const oppIdx = 1 - playerIndex;

    // Cleanup
    socket.off('game_state');
    socket.off('invalid_move');

    socket.on('game_state', (data) => render(data));
    socket.on('invalid_move', (msg) => alert(msg));

    // Render immediately
    if (initialState) {
        render(initialState);
    }

    function render(state) {
        const { grids, activePlayerIndex, isGameOver, winner } = state;
        const myGridData = grids[myIdx];
        const oppGridData = grids[oppIdx];

        // 1. Render Target Grid (Opponent's grid, but hidden ships)
        renderGrid(targetEl, oppGridData, true);

        // 2. Render My Grid (Visible ships)
        renderGrid(myEl, myGridData, false);

        // Status
        if (isGameOver) {
            const msg = winner === myIdx ? "You Won!" : "You Lost!";
            statusEl.textContent = msg;
            showStatus(msg);
        } else {
            statusEl.textContent = activePlayerIndex === myIdx ? "Your Turn - Fire!" : "Opponent's Turn";
            statusEl.style.color = activePlayerIndex === myIdx ? "#4caf50" : "#fff";
        }
    }

    function renderGrid(element, gridData, isTarget) {
        element.innerHTML = '';
        gridData.forEach((row, r) => {
            row.forEach((cellVal, c) => {
                const cell = document.createElement('div');
                cell.className = 'bs-cell';

                if (cellVal === 2) {
                    cell.classList.add('miss');
                } else if (cellVal === 3) {
                    cell.classList.add('hit');
                } else if (cellVal === 1) {
                    if (!isTarget) {
                        cell.classList.add('ship');
                    }
                }

                if (isTarget) {
                    cell.addEventListener('click', () => {
                        if (cellVal === 2 || cellVal === 3) return;
                        socket.emit('make_move', { roomId, move: { row: r, col: c } });
                    });
                }

                element.appendChild(cell);
            });
        });
    }
}
