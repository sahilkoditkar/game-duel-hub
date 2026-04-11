function initDotsAndBoxes(socket, container, roomId, playerIndex, initialState) {
    // Remove old styles on re-init
    const oldStyle = document.getElementById('dotsandboxes-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'dotsandboxes-styles';
    style.innerHTML = `
        .db-board {
            display: grid;
            grid-template-columns: auto 1fr auto 1fr auto 1fr auto;
            grid-template-rows: auto 1fr auto 1fr auto 1fr auto;
            max-width: min(90vw, 350px);
            width: 100%;
            margin: 20px auto;
            user-select: none;
            aspect-ratio: 1;
        }
        .dot {
            width: clamp(8px, 2.5vw, 14px);
            height: clamp(8px, 2.5vw, 14px);
            background: #fff;
            border-radius: 50%;
            z-index: 2;
            place-self: center;
        }
        .hline {
            background: #333;
            cursor: pointer;
            height: clamp(6px, 1.5vw, 12px);
            place-self: center stretch;
            border-radius: 3px;
            position: relative;
            transition: background 0.2s;
            touch-action: manipulation;
        }
        .hline::before {
            content: '';
            position: absolute;
            top: -14px;
            bottom: -14px;
            left: 0;
            right: 0;
        }
        .hline.taken { cursor: default; }
        .hline:not(.taken):active { background: #666; }

        .vline {
            background: #333;
            cursor: pointer;
            width: clamp(6px, 1.5vw, 12px);
            place-self: stretch center;
            border-radius: 3px;
            position: relative;
            transition: background 0.2s;
            touch-action: manipulation;
        }
        .vline::before {
            content: '';
            position: absolute;
            left: -14px;
            right: -14px;
            top: 0;
            bottom: 0;
        }
        .vline.taken { cursor: default; }
        .vline:not(.taken):active { background: #666; }

        .box {
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: clamp(1rem, 3vw, 1.5rem);
            color: #000;
            border-radius: 4px;
            transition: background 0.3s;
        }

        .p0-bg { background-color: var(--primary-color) !important; }
        .p1-bg { background-color: var(--secondary-color) !important; }
        .p0-text { color: var(--primary-color) !important; }
        .p1-text { color: var(--secondary-color) !important; }

        @media (hover: hover) {
            .hline:not(.taken):hover { background: #555; }
            .vline:not(.taken):hover { background: #555; }
        }
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

    // Build the CSS Grid board
    // 7 rows, 7 cols: dots at even positions, lines/boxes at odd positions
    let html = '';
    for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
            const gridRow = r + 1;
            const gridCol = c + 1;
            const posStyle = `grid-row:${gridRow};grid-column:${gridCol};`;

            if (r % 2 === 0 && c % 2 === 0) {
                // Dot
                html += `<div class="dot" style="${posStyle}"></div>`;
            } else if (r % 2 === 0 && c % 2 === 1) {
                // Horizontal line
                const lr = r / 2;
                const lc = (c - 1) / 2;
                html += `<div class="hline" data-r="${lr}" data-c="${lc}" style="${posStyle}"></div>`;
            } else if (r % 2 === 1 && c % 2 === 0) {
                // Vertical line
                const lr = (r - 1) / 2;
                const lc = c / 2;
                html += `<div class="vline" data-r="${lr}" data-c="${lc}" style="${posStyle}"></div>`;
            } else {
                // Box (both odd)
                const br = (r - 1) / 2;
                const bc = (c - 1) / 2;
                html += `<div class="box" id="box-${br}-${bc}" style="${posStyle}"></div>`;
            }
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
                    }
                }
            });
        });
    }
}
