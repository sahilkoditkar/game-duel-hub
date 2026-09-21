function initMancala(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('mancala-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'mancala-styles';
    style.textContent = `
        .mc-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: 100%;
            max-width: 480px;
            margin: 0 auto;
            user-select: none;
        }
        .mc-info {
            font-size: 0.85rem;
            color: #888;
            text-align: center;
        }
        .mc-scores {
            display: flex;
            justify-content: space-between;
            width: 100%;
            font-size: 0.9rem;
            padding: 0 4px;
            box-sizing: border-box;
        }
        .mc-scores .me { color: var(--secondary-color); font-weight: bold; }
        .mc-board {
            display: grid;
            grid-template-columns: minmax(0, 1fr) repeat(6, minmax(0, 1.2fr)) minmax(0, 1fr);
            grid-template-rows: 1fr 1fr;
            gap: clamp(3px, 1.2vw, 6px);
            width: 100%;
            background: #5c3d1e;
            border: 4px solid #3d2812;
            border-radius: 16px;
            padding: clamp(5px, 1.5vw, 10px);
            box-sizing: border-box;
            touch-action: manipulation;
        }
        .mc-store {
            min-width: 0;
            grid-row: 1 / span 2;
            background: #3d2812;
            border-radius: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            min-height: 100px;
            border: 2px solid transparent;
        }
        .mc-store.left { grid-column: 1; }
        .mc-store.right { grid-column: 8; }
        .mc-store.mine { border-color: var(--secondary-color); }
        .mc-pit {
            min-width: 0;
            position: relative;
            aspect-ratio: 1;
            background: #3d2812;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            cursor: default;
            border: 2px solid transparent;
            transition: border-color 0.2s, background 0.2s, transform 0.1s;
            touch-action: manipulation;
        }
        .mc-pit.playable {
            cursor: pointer;
            border-color: var(--secondary-color);
            background: #4a3018;
        }
        .mc-pit.playable:active { transform: scale(0.93); }
        .mc-pit.last { box-shadow: 0 0 0 2px #facc15; }
        .mc-pit.captured { box-shadow: 0 0 0 2px #ef4444; }
        .mc-count {
            font-size: clamp(0.85rem, 3.6vw, 1.15rem);
            font-weight: bold;
            line-height: 1;
            color: #fff;
        }
        .mc-store .mc-count { font-size: clamp(1.1rem, 4.5vw, 1.5rem); }
        .mc-dots {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 1px;
            width: 70%;
            max-height: 40%;
            overflow: hidden;
        }
        .mc-dot {
            width: clamp(3px, 1vw, 5px);
            height: clamp(3px, 1vw, 5px);
            border-radius: 50%;
            background: #e6c98a;
        }
        .mc-store .mc-dot { background: #a5d6a7; }
        .mc-label {
            font-size: 0.65rem;
            color: #aaa;
            position: absolute;
            bottom: -14px;
        }
        .mc-pit.top .mc-label { bottom: auto; top: -14px; }
        .mc-row-label {
            width: 100%;
            font-size: 0.75rem;
            color: #888;
            text-align: center;
        }
        .mc-last {
            font-size: 0.85rem;
            color: #aaa;
            text-align: center;
            min-height: 1.2em;
        }
        @media (hover: hover) {
            .mc-pit.playable:hover { background: #5a3b1e; }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="mc-wrap">
            <div class="mc-info">Sow counter-clockwise. End in your store: go again. End in your empty pit: capture the pit across.</div>
            <div class="mc-scores"><span id="mc-score-opp">Opponent: 0</span><span class="me" id="mc-score-me">You: 0</span></div>
            <div class="mc-row-label">Opponent's pits</div>
            <div class="mc-board" id="mc-board"></div>
            <div class="mc-row-label">Your pits (tap to sow)</div>
            <div class="mc-last" id="mc-last"></div>
        </div>
    `;

    const boardEl = document.getElementById('mc-board');
    const statusEl = document.getElementById('game-status');
    const lastEl = document.getElementById('mc-last');
    const scoreMe = document.getElementById('mc-score-me');
    const scoreOpp = document.getElementById('mc-score-opp');
    const myIdx = playerIndex;
    const oppIdx = 1 - myIdx;
    const ownBase = myIdx * 7;
    const oppBase = oppIdx * 7;
    let lastState = initialState || null;

    // Layout: opponent's store on the left, my store on the right. Top row shows the
    // opponent's pits mirrored (their pit 5 at the left) so sowing flows in a loop.
    const slotEls = {}; // absolute index -> element

    function makeSlot(cls, absIndex) {
        const el = document.createElement('div');
        el.className = cls;
        const count = document.createElement('div');
        count.className = 'mc-count';
        const dots = document.createElement('div');
        dots.className = 'mc-dots';
        el.appendChild(count);
        el.appendChild(dots);
        slotEls[absIndex] = el;
        return el;
    }

    const oppStore = makeSlot('mc-store left', oppBase + 6);
    boardEl.appendChild(oppStore);
    for (let i = 5; i >= 0; i--) {
        const pit = makeSlot('mc-pit top', oppBase + i);
        pit.style.gridRow = '1';
        pit.style.gridColumn = String(2 + (5 - i));
        boardEl.appendChild(pit);
    }
    const myStore = makeSlot('mc-store right mine', ownBase + 6);
    boardEl.appendChild(myStore);
    for (let i = 0; i < 6; i++) {
        const pit = makeSlot('mc-pit bottom', ownBase + i);
        pit.style.gridRow = '2';
        pit.style.gridColumn = String(2 + i);
        const label = document.createElement('div');
        label.className = 'mc-label';
        label.textContent = String(i + 1);
        pit.appendChild(label);
        pit.addEventListener('click', () => {
            if (!canAct(lastState, myIdx)) return;
            if (lastState && lastState.pits[ownBase + i] === 0) return;
            socket.emit('make_move', { roomId, move: { pit: i } });
        });
        boardEl.appendChild(pit);
    }

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => { if (typeof showToast === 'function') showToast(msg); else alert(msg); });

    if (initialState) render(initialState);

    function fillSlot(el, n) {
        el.children[0].textContent = String(n);
        const dots = el.children[1];
        const shown = Math.min(n, 16);
        while (dots.children.length > shown) dots.removeChild(dots.lastChild);
        while (dots.children.length < shown) {
            const d = document.createElement('div');
            d.className = 'mc-dot';
            dots.appendChild(d);
        }
    }

    function render(state) {
        lastState = state;
        const { pits, lastMove, activePlayerIndex, isGameOver, winner } = state;
        const myTurn = !isGameOver && activePlayerIndex === myIdx;

        for (let idx = 0; idx < 14; idx++) {
            const el = slotEls[idx];
            fillSlot(el, pits[idx]);
            el.classList.remove('playable', 'last', 'captured');
            if (myTurn && idx >= ownBase && idx <= ownBase + 5 && pits[idx] > 0) el.classList.add('playable');
        }
        if (lastMove && slotEls[lastMove.index]) {
            slotEls[lastMove.index].classList.add('last');
        }

        scoreMe.textContent = 'You: ' + pits[ownBase + 6];
        scoreOpp.textContent = 'Opponent: ' + pits[oppBase + 6];

        if (lastMove) {
            const who = lastMove.player === myIdx ? 'You' : 'Opponent';
            let text = who + ' sowed pit ' + (lastMove.pit + 1);
            if (lastMove.captured > 0) text += ' and captured ' + lastMove.captured + ' stones!';
            else if (lastMove.extraTurn && !isGameOver) text += ' - extra turn!';
            else text += '.';
            lastEl.textContent = text;
        } else {
            lastEl.textContent = '';
        }

        if (isGameOver) {
            const msg = winner === 'draw' ? "It's a Draw!" : (winner === myIdx ? 'You Won!' : 'You Lost!');
            statusEl.textContent = msg;
            statusEl.style.color = '';
            showStatus(msg);
        } else {
            statusEl.textContent = myTurn ? 'Your Turn' : "Opponent's Turn";
            statusEl.style.color = myTurn ? '#4caf50' : '#fff';
        }
    }
}
