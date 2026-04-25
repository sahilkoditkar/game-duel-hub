function initMemory(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('memory-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'memory-styles';
    style.innerHTML = `
        .mem-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            width: 100%;
            max-width: 400px;
            margin: 0 auto;
            user-select: none;
        }
        .mem-board {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: clamp(6px, 2vw, 10px);
            width: 100%;
        }
        .mem-card {
            aspect-ratio: 1;
            perspective: 600px;
            cursor: pointer;
            touch-action: manipulation;
        }
        .mem-card-inner {
            width: 100%;
            height: 100%;
            position: relative;
            transition: transform 0.5s;
            transform-style: preserve-3d;
        }
        .mem-card.flipped .mem-card-inner,
        .mem-card.matched .mem-card-inner {
            transform: rotateY(180deg);
        }
        .mem-card-front, .mem-card-back {
            position: absolute;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .mem-card-front {
            background: linear-gradient(135deg, #3b3b5c, #2a2a40);
            border: 2px solid #555;
            font-size: clamp(1.2rem, 3vw, 1.5rem);
            color: #666;
        }
        .mem-card-back {
            background: #333;
            border: 2px solid var(--primary-color);
            transform: rotateY(180deg);
            font-size: clamp(1.8rem, 5vw, 2.5rem);
        }
        .mem-card.matched .mem-card-back {
            border-color: var(--secondary-color);
            background: #1a3a2a;
        }
        .mem-card:active:not(.matched):not(.flipped) {
            transform: scale(0.95);
        }
        .mem-scores {
            display: flex;
            gap: 30px;
            font-size: 1.1rem;
            font-weight: bold;
        }
        .mem-score-p0 { color: var(--primary-color); }
        .mem-score-p1 { color: var(--secondary-color); }
        .mem-info {
            font-size: 0.85rem;
            color: #888;
            text-align: center;
        }
        @media (hover: hover) {
            .mem-card:hover:not(.matched):not(.flipped) {
                transform: scale(1.03);
            }
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Game Started</h3>
        <div class="mem-container">
            <div class="mem-scores">
                <span class="mem-score-p0">You: <span id="mem-s0">0</span></span>
                <span class="mem-score-p1">Opp: <span id="mem-s1">0</span></span>
            </div>
            <div class="mem-board" id="mem-board"></div>
            <div class="mem-info">Match pairs to score. Match = keep your turn!</div>
        </div>
    `;

    const boardEl = document.getElementById('mem-board');
    const statusEl = document.getElementById('game-status');
    const s0El = document.getElementById('mem-s0');
    const s1El = document.getElementById('mem-s1');
    const myIdx = playerIndex;

    // Create 16 cards
    for (let i = 0; i < 16; i++) {
        const card = document.createElement('div');
        card.className = 'mem-card';
        card.dataset.index = i;

        card.innerHTML = `
            <div class="mem-card-inner">
                <div class="mem-card-front">?</div>
                <div class="mem-card-back" id="mem-back-${i}"></div>
            </div>
        `;

        card.addEventListener('click', () => {
            socket.emit('make_move', { roomId, move: { index: i } });
        });
        boardEl.appendChild(card);
    }

    socket.off('game_state');
    socket.off('invalid_move');

    socket.on('game_state', (data) => render(data));
    socket.on('invalid_move', (msg) => alert(msg));

    if (initialState) render(initialState);

    function render(state) {
        const { cards, revealed, flipped, scores, activePlayerIndex, isGameOver, winner } = state;

        // Update scores
        s0El.textContent = scores[myIdx];
        s1El.textContent = scores[1 - myIdx];

        // Update cards
        for (let i = 0; i < 16; i++) {
            const card = boardEl.children[i];
            const backEl = document.getElementById(`mem-back-${i}`);

            card.className = 'mem-card';

            if (revealed[i]) {
                card.classList.add('matched');
                backEl.textContent = cards[i] || '';
            } else if (flipped.includes(i)) {
                card.classList.add('flipped');
                backEl.textContent = cards[i] || '';
            } else {
                backEl.textContent = '';
            }
        }

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
            statusEl.textContent =
                activePlayerIndex === myIdx ? 'Your Turn - Pick a card!' : "Opponent's Turn";
            statusEl.style.color = activePlayerIndex === myIdx ? '#4caf50' : '#fff';
        }
    }
}
