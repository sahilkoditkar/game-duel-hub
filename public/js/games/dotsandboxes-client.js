function initDotsAndBoxes(socket, container, roomId, playerIndex, initialState) {
    const style = document.createElement('style');
    style.innerHTML = `
        .db-board {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 20px auto;
            user-select: none;
        }
        .db-row {
            display: flex;
        }
        .dot {
            width: 10px;
            height: 10px;
            background: #fff;
            border-radius: 50%;
            z-index: 2;
        }
        .hline {
            width: 60px;
            height: 10px;
            background: #333;
            margin: 0 2px;
            cursor: pointer;
            position: relative;
        }
        .hline.taken { cursor: default; }
        .hline:hover:not(.taken) { background: #555; }
        
        .vline-row {
            display: flex;
        }
        .vline {
            width: 10px;
            height: 60px;
            background: #333;
            margin: 2px 0;
            cursor: pointer;
            margin-right: 64px; /* Space for box */
        }
        .vline:last-child { margin-right: 0; }
        .vline.taken { cursor: default; }
        .vline:hover:not(.taken) { background: #555; }

        .box {
            width: 60px;
            height: 60px;
            margin-top: 2px;
            margin-left: -62px; /* Pull back into gap */
            margin-right: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.5rem;
            color: #000;
        }
        
        .p0-bg { background-color: var(--primary-color) !important; }
        .p1-bg { background-color: var(--secondary-color) !important; }
        .p0-text { color: var(--primary-color) !important; }
        .p1-text { color: var(--secondary-color) !important; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div id="db-board" class="db-board"></div>
        <div id="db-scores" style="display:flex; gap:20px; font-weight:bold; margin-top:10px;">
           <span class="p0-text">Player 1: <span id="s-p0">0</span></span>
           <span class="p1-text">Player 2: <span id="s-p1">0</span></span>
        </div>
    `;

    const boardEl = document.getElementById('db-board');
    const statusEl = document.getElementById('game-status');
    const score0El = document.getElementById('s-p0');
    const score1El = document.getElementById('s-p1');
    const myIdx = playerIndex;

    // Build the grid
    // 4 rows of dots, 3 rows of boxes
    // Row 0: Dots + H-lines
    // Row 0-1 Gap: V-lines + Boxes

    let html = '';
    for (let r = 0; r < 4; r++) {
        // Dots and Horizontal Lines
        html += '<div class="db-row">';
        for (let c = 0; c < 4; c++) {
            html += '<div class="dot"></div>';
            if (c < 3) {
                html += `<div class="hline" data-r="${r}" data-c="${c}"></div>`;
            }
        }
        html += '</div>';

        // Vertical Lines and Boxes (only if not last row of dots)
        if (r < 3) {
            html += '<div class="db-row">';
            for (let c = 0; c < 4; c++) {
                html += `<div class="vline" data-r="${r}" data-c="${c}"></div>`;
                if (c < 3) {
                    html += `<div class="box" id="box-${r}-${c}"></div>`;
                }
            }
            html += '</div>';
        }
    }
    boardEl.innerHTML = html;

    // Attach listeners
    document.querySelectorAll('.hline').forEach(el => {
        el.addEventListener('click', () => {
            if (el.classList.contains('taken')) return;
            const r = parseInt(el.dataset.r);
            const c = parseInt(el.dataset.c);
            socket.emit('make_move', { roomId, move: { type: 'h', row: r, col: c } });
        });
    });

    document.querySelectorAll('.vline').forEach(el => {
        el.addEventListener('click', () => {
            if (el.classList.contains('taken')) return;
            const r = parseInt(el.dataset.r);
            const c = parseInt(el.dataset.c);
            socket.emit('make_move', { roomId, move: { type: 'v', row: r, col: c } });
        });
    });

    // Cleanup
    socket.off('game_state');
    socket.off('invalid_move');

    socket.on('game_state', (data) => render(data));
    socket.on('invalid_move', (msg) => alert(msg));

    if (initialState) {
        render(initialState);
    }

    function render(state) {
        const { hLines, vLines, boxes, scores, activePlayerIndex, isGameOver, winner } = state;

        // Update turn status
        if (isGameOver) {
            if (winner === 'draw') {
                showStatus("It's a Draw!");
                statusEl.textContent = "Draw!";
            } else {
                const msg = winner === myIdx ? "You Won!" : "You Lost!";
                showStatus(msg);
                statusEl.textContent = msg;
            }
        } else {
            statusEl.textContent = activePlayerIndex === myIdx ? "Your Turn" : "Opponent's Turn";
            statusEl.style.color = activePlayerIndex === myIdx ? "#4caf50" : "#fff";
        }

        // Update scores
        score0El.textContent = scores[0];
        score1El.textContent = scores[1];

        // Draw lines
        hLines.forEach((row, r) => {
            row.forEach((owner, c) => {
                if (owner !== null) {
                    const el = document.querySelector(`.hline[data-r="${r}"][data-c="${c}"]`);
                    if (el) {
                        el.classList.add('taken');
                        el.classList.add(owner === 0 ? 'p0-bg' : 'p1-bg');
                    }
                }
            });
        });

        vLines.forEach((row, r) => {
            row.forEach((owner, c) => {
                if (owner !== null) {
                    const el = document.querySelector(`.vline[data-r="${r}"][data-c="${c}"]`);
                    if (el) {
                        el.classList.add('taken');
                        el.classList.add(owner === 0 ? 'p0-bg' : 'p1-bg');
                    }
                }
            });
        });

        // Fill boxes
        boxes.forEach((row, r) => {
            row.forEach((owner, c) => {
                if (owner !== null) {
                    const box = document.getElementById(`box-${r}-${c}`);
                    if (box) {
                        box.classList.add(owner === 0 ? 'p0-bg' : 'p1-bg');
                        // box.textContent = owner === 0 ? 'P1' : 'P2';
                    }
                }
            });
        });
    }
}
