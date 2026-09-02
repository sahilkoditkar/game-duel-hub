function initRps(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('rps-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'rps-styles';
    style.innerHTML = `
        .rps-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            width: 100%;
            max-width: 420px;
        }
        .rps-score {
            display: flex;
            gap: 24px;
            font-weight: bold;
            font-size: 1.1rem;
        }
        .rps-score .me { color: var(--secondary-color); }
        .rps-score .opp { color: var(--primary-color); }
        .rps-round {
            color: #aaa;
            font-size: 0.95rem;
        }
        .rps-choices {
            display: flex;
            gap: 12px;
            width: 100%;
            justify-content: center;
        }
        .rps-btn {
            flex: 1;
            max-width: 110px;
            aspect-ratio: 1;
            border: 2px solid #333;
            background: #2c2c2c;
            border-radius: 16px;
            font-size: clamp(2rem, 8vw, 3rem);
            cursor: pointer;
            touch-action: manipulation;
            transition: transform 0.1s, border-color 0.15s, background 0.15s;
        }
        .rps-btn:active:not(:disabled) { transform: scale(0.94); }
        .rps-btn.selected {
            border-color: var(--secondary-color);
            background: #14332f;
        }
        .rps-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .rps-last {
            min-height: 3.2em;
            text-align: center;
            color: #ddd;
            font-size: 1rem;
        }
        .rps-waiting { color: #aaa; font-size: 0.9rem; }
        .rps-labels {
            display: flex;
            justify-content: space-between;
            width: 100%;
            max-width: 354px;
            font-size: 0.75rem;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Best of 3</h3>
        <div class="rps-wrap">
            <div class="rps-score">
                <span class="me">You <span id="rps-me">0</span></span>
                <span class="opp">Opp <span id="rps-opp">0</span></span>
            </div>
            <div class="rps-round" id="rps-round">Round 1 · first to 2</div>
            <div class="rps-last" id="rps-last"></div>
            <div class="rps-waiting" id="rps-waiting"></div>
            <div class="rps-choices">
                <button class="rps-btn" data-choice="rock" title="Rock">✊</button>
                <button class="rps-btn" data-choice="paper" title="Paper">✋</button>
                <button class="rps-btn" data-choice="scissors" title="Scissors">✌️</button>
            </div>
            <div class="rps-labels">
                <span>Rock</span><span>Paper</span><span>Scissors</span>
            </div>
        </div>
    `;

    const statusEl = document.getElementById('game-status');
    const meEl = document.getElementById('rps-me');
    const oppEl = document.getElementById('rps-opp');
    const roundEl = document.getElementById('rps-round');
    const lastEl = document.getElementById('rps-last');
    const waitingEl = document.getElementById('rps-waiting');
    const buttons = [...container.querySelectorAll('.rps-btn')];
    const icon = { rock: '✊', paper: '✋', scissors: '✌️' };

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            socket.emit('make_move', { roomId, move: { choice: btn.dataset.choice } });
        });
    });

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (data) => render(data));
    socket.on('invalid_move', (msg) => {
        if (typeof showToast === 'function') showToast(msg);
        else alert(msg);
    });

    if (initialState) render(initialState);

    function render(state) {
        const { myChoice, opponentReady, round, roundWins, winsNeeded, lastRound, isGameOver, winner } = state;
        meEl.textContent = roundWins[playerIndex];
        oppEl.textContent = roundWins[1 - playerIndex];
        roundEl.textContent = isGameOver
            ? 'Match over'
            : `Round ${round} · first to ${winsNeeded}`;

        buttons.forEach(btn => {
            btn.classList.toggle('selected', myChoice === btn.dataset.choice);
            btn.disabled = Boolean(myChoice) || isGameOver;
        });

        if (lastRound) {
            const mine = lastRound.choices[playerIndex];
            const theirs = lastRound.choices[1 - playerIndex];
            let result = 'Tied that round';
            if (lastRound.winner === playerIndex) result = 'You won the round';
            else if (lastRound.winner === 1 - playerIndex) result = 'Opponent won the round';
            lastEl.textContent = `${icon[mine]} vs ${icon[theirs]} — ${result}`;
        } else {
            lastEl.textContent = 'Lock in a throw. Opponent cannot see it until both have chosen.';
        }

        if (isGameOver) {
            waitingEl.textContent = '';
            const msg = winner === playerIndex ? 'You Won!' : 'You Lost!';
            statusEl.textContent = msg;
            showStatus(msg);
        } else if (myChoice && !opponentReady) {
            waitingEl.textContent = 'Locked in. Waiting for opponent...';
            statusEl.textContent = 'Waiting for opponent';
        } else if (!myChoice && opponentReady) {
            waitingEl.textContent = 'Opponent is ready. Your throw!';
            statusEl.textContent = 'Your turn';
        } else {
            waitingEl.textContent = '';
            statusEl.textContent = 'Choose at the same time';
        }
    }
}
