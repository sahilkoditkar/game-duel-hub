function initSim(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('sim-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'sim-styles';
    style.textContent = `
        .sim-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 400px;
            margin: 0 auto;
            user-select: none;
        }
        .sim-board {
            width: 100%;
            max-width: min(92vw, 340px);
            aspect-ratio: 1;
            background: #222;
            border-radius: 12px;
            touch-action: manipulation;
        }
        .sim-board svg { width: 100%; height: 100%; display: block; }
        .sim-edge {
            stroke: #444;
            stroke-width: 3;
            stroke-linecap: round;
            transition: stroke 0.2s, stroke-width 0.2s;
            pointer-events: none;
        }
        .sim-edge.p0 { stroke: var(--primary-color); stroke-width: 7; }
        .sim-edge.p1 { stroke: var(--secondary-color); stroke-width: 7; }
        .sim-edge.last { filter: drop-shadow(0 0 4px #fff); }
        .sim-edge.lose { stroke: #ef4444; stroke-width: 10; }
        .sim-hit {
            stroke: transparent;
            stroke-width: 26;
            stroke-linecap: round;
            fill: none;
            cursor: pointer;
            pointer-events: stroke;
        }
        .sim-hit.taken { cursor: default; pointer-events: none; }
        .sim-dot { fill: #fff; stroke: #111; stroke-width: 2; pointer-events: none; }
        .sim-dot.lose { fill: #ef4444; }
        .sim-dot-label {
            fill: #000; font-size: 12px; font-weight: bold; text-anchor: middle;
            dominant-baseline: central; pointer-events: none;
        }
        .sim-info { font-size: 0.85rem; color: #888; text-align: center; }
        .sim-legend {
            display: flex; gap: 20px; justify-content: center; font-size: 0.9rem; flex-wrap: wrap;
        }
        .sim-swatch {
            display: inline-block; width: 22px; height: 6px; border-radius: 3px;
            vertical-align: middle; margin-right: 6px;
        }
        .sim-count { font-size: 0.9rem; color: #aaa; }
        @media (hover: hover) {
            .sim-hit:not(.taken):hover { stroke: rgba(255,255,255,0.12); }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="sim-wrap">
            <div class="sim-info">Tap a grey line to color it. Complete a triangle in your color and you lose!</div>
            <div class="sim-board"><svg id="sim-svg" viewBox="0 0 300 300"></svg></div>
            <div class="sim-legend">
                <span><span class="sim-swatch" style="background:var(--primary-color)"></span>Player 1 <span id="sim-c0">(0)</span></span>
                <span><span class="sim-swatch" style="background:var(--secondary-color)"></span>Player 2 <span id="sim-c1">(0)</span></span>
            </div>
            <div class="sim-count" id="sim-you"></div>
        </div>
    `;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.getElementById('sim-svg');
    const statusEl = document.getElementById('game-status');
    const c0El = document.getElementById('sim-c0');
    const c1El = document.getElementById('sim-c1');
    const youEl = document.getElementById('sim-you');
    const myIdx = playerIndex;
    let lastState = initialState || null;

    youEl.textContent = `You are ${myIdx === 0 ? 'Player 1 (purple)' : 'Player 2 (teal)'}`;

    // Six dots on a circle
    const DOTS = 6;
    const pts = [];
    for (let i = 0; i < DOTS; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / DOTS;
        pts.push({ x: 150 + 118 * Math.cos(ang), y: 150 + 118 * Math.sin(ang) });
    }

    const edgeEls = {}; // "a-b" -> { line, hit }
    for (let a = 0; a < DOTS; a++) {
        for (let b = a + 1; b < DOTS; b++) {
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', pts[a].x); line.setAttribute('y1', pts[a].y);
            line.setAttribute('x2', pts[b].x); line.setAttribute('y2', pts[b].y);
            line.setAttribute('class', 'sim-edge');
            svg.appendChild(line);
            edgeEls[`${a}-${b}`] = { line, hit: null };
        }
    }
    // Wide invisible hit targets on top of the visible lines
    for (let a = 0; a < DOTS; a++) {
        for (let b = a + 1; b < DOTS; b++) {
            const hit = document.createElementNS(svgNS, 'line');
            hit.setAttribute('x1', pts[a].x); hit.setAttribute('y1', pts[a].y);
            hit.setAttribute('x2', pts[b].x); hit.setAttribute('y2', pts[b].y);
            hit.setAttribute('class', 'sim-hit');
            hit.addEventListener('click', () => {
                if (hit.classList.contains('taken')) return;
                if (!canAct(lastState, myIdx)) return;
                socket.emit('make_move', { roomId, move: { a, b } });
            });
            svg.appendChild(hit);
            edgeEls[`${a}-${b}`].hit = hit;
        }
    }
    const dotEls = [];
    pts.forEach((p, i) => {
        const dot = document.createElementNS(svgNS, 'circle');
        dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('r', 11);
        dot.setAttribute('class', 'sim-dot');
        svg.appendChild(dot);
        const label = document.createElementNS(svgNS, 'text');
        label.setAttribute('x', p.x); label.setAttribute('y', p.y);
        label.setAttribute('class', 'sim-dot-label');
        label.textContent = String(i + 1);
        svg.appendChild(label);
        dotEls.push(dot);
    });

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => { if (typeof showToast === 'function') showToast(msg); else alert(msg); });

    if (initialState) render(initialState);

    function render(state) {
        lastState = state;
        const edges = Array.isArray(state.edges) ? state.edges : [];
        const tri = Array.isArray(state.losingTriangle) ? state.losingTriangle : null;
        const last = state.lastMove;
        const counts = [0, 0];

        Object.keys(edgeEls).forEach(k => {
            edgeEls[k].line.setAttribute('class', 'sim-edge');
            edgeEls[k].hit.setAttribute('class', 'sim-hit');
        });
        edges.forEach(e => {
            const el = edgeEls[`${e.a}-${e.b}`];
            if (!el) return;
            el.line.classList.add(e.owner === 0 ? 'p0' : 'p1');
            el.hit.classList.add('taken');
            if (e.owner === 0 || e.owner === 1) counts[e.owner]++;
            if (last && last.a === e.a && last.b === e.b) el.line.classList.add('last');
        });
        dotEls.forEach(d => d.classList.remove('lose'));
        if (tri) {
            for (let i = 0; i < 3; i++) {
                for (let j = i + 1; j < 3; j++) {
                    const a = Math.min(tri[i], tri[j]);
                    const b = Math.max(tri[i], tri[j]);
                    const el = edgeEls[`${a}-${b}`];
                    if (el) el.line.classList.add('lose');
                }
                if (dotEls[tri[i]]) dotEls[tri[i]].classList.add('lose');
            }
        }
        c0El.textContent = `(${counts[0]})`;
        c1El.textContent = `(${counts[1]})`;

        if (state.isGameOver) {
            const msg = state.winner === 'draw' ? "It's a Draw!" : (state.winner === myIdx ? 'You Won!' : 'You Lost!');
            statusEl.textContent = msg;
            statusEl.style.color = '#fff';
            showStatus(msg);
        } else {
            statusEl.textContent = state.activePlayerIndex === myIdx ? 'Your Turn' : "Opponent's Turn";
            statusEl.style.color = state.activePlayerIndex === myIdx ? '#4caf50' : '#fff';
        }
    }
}
