function initMastermind(socket, gameArea, roomId, playerIndex, initialState) {
    console.log('Initializing Mastermind for player', playerIndex);

    let currentInput = [];

    const oldStyle = document.getElementById('mastermind-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'mastermind-styles';
    style.innerHTML = `
        .mm-container {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            align-items: center;
            width: 100%;
            max-width: 500px;
            margin: 0 auto;
            user-select: none;
        }
        .mm-board {
            display: flex;
            flex-direction: column;
            gap: 10px;
            width: 100%;
            background: #222;
            padding: 1rem;
            border-radius: 8px;
            max-height: clamp(200px, 35vh, 400px);
            overflow-y: auto;
        }
        .mm-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #333;
            padding: 5px 10px;
            border-radius: 4px;
        }
        .mm-code-slots {
            display: flex;
            gap: 10px;
        }
        .mm-slot {
            width: clamp(28px, 7vw, 40px);
            height: clamp(28px, 7vw, 40px);
            border-radius: 50%;
            background: #444;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            border: 2px solid #555;
            font-size: clamp(0.8rem, 2vw, 1rem);
        }
        .mm-slot.correct { background: #10b981; border-color: #059669; }
        .mm-slot.present { background: #facc15; border-color: #d97706; color: black; }
        .mm-slot.absent { background: #333; border-color: #222; opacity: 0.7; }

        .mm-secret-display {
             padding: 1rem;
             background: #1e293b;
             border-radius: 8px;
             margin-bottom: 1rem;
             display: none;
        }

        .mm-controls {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            align-items: center;
        }
        .mm-input-display {
            display: flex;
            gap: 1rem;
            margin-bottom: 0.5rem;
        }
        .mm-keypad {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            width: 100%;
        }
        .mm-key {
            padding: 15px;
            font-size: 1.2rem;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            touch-action: manipulation;
        }
        .mm-key:active { background: #2563eb; transform: scale(0.92); }
        .mm-action-btn {
            width: 100%;
            padding: 12px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1.1rem;
            cursor: pointer;
            touch-action: manipulation;
            transition: transform 0.1s;
        }
        .mm-action-btn:active { transform: scale(0.97); }
        .mm-action-btn.delete { background: #ef4444; }
        .mm-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .mm-status {
             font-size: 1.2rem;
             color: #fbbf24;
             text-align: center;
        }
        .mm-attempts {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            font-size: 1.1rem;
            font-weight: bold;
            padding: 10px 20px;
            background: #1e293b;
            border-radius: 8px;
            border: 2px solid #334155;
        }
        .mm-attempts .label { color: #94a3b8; }
        .mm-attempts .count { color: var(--secondary-color); font-size: 1.4rem; }
        .mm-attempts.warning .count { color: #fbbf24; }
        .mm-attempts.danger .count { color: #ef4444; animation: pulse 0.8s infinite alternate; }
        @media (hover: hover) {
            .mm-key:hover { background: #2563eb; }
        }
    `;
    document.head.appendChild(style);

    // Initial Markup
    gameArea.innerHTML = `
        <div class="mm-container">
            <h3 id="role-display">Role: ...</h3>
            <div id="mm-status" class="mm-status">Waiting...</div>

            <div id="mm-attempts" class="mm-attempts" style="display:none;">
                <span class="label">Attempts left:</span>
                <span class="count" id="mm-attempts-count">4</span>
                <span class="label">/ <span id="mm-attempts-max">4</span></span>
            </div>

            <div id="secret-display" class="mm-secret-display">
                 <div>Secret Code:</div>
                 <div class="mm-code-slots" id="secret-slots"></div>
            </div>

            <div id="mm-board" class="mm-board">
                <!-- History rows go here -->
            </div>

            <div class="mm-controls" id="mm-controls">
                <div class="mm-input-display" id="input-display">
                    <div class="mm-slot"></div>
                    <div class="mm-slot"></div>
                    <div class="mm-slot"></div>
                    <div class="mm-slot"></div>
                </div>

                <div class="mm-keypad">
                    <button class="mm-key" onclick="mmType(0)">0</button>
                    <button class="mm-key" onclick="mmType(1)">1</button>
                    <button class="mm-key" onclick="mmType(2)">2</button>
                    <button class="mm-key" onclick="mmType(3)">3</button>
                    <button class="mm-key" onclick="mmType(4)">4</button>
                    <button class="mm-key" onclick="mmType(5)">5</button>
                    <button class="mm-key" onclick="mmType(6)">6</button>
                    <button class="mm-key" onclick="mmType(7)">7</button>
                    <button class="mm-key" onclick="mmType(8)">8</button>
                    <button class="mm-key" onclick="mmType(9)">9</button>
                </div>

                <div style="display:flex; gap:10px; width:100%">
                    <button class="mm-action-btn delete" onclick="mmDelete()">&#9003;</button>
                    <button class="mm-action-btn" id="submit-btn" onclick="mmSubmit()">Submit</button>
                </div>
            </div>
        </div>
    `;

    // Globals for easy access in handlers
    window.mmType = (digit) => {
        if (currentInput.length < 4) {
            currentInput.push(digit);
            renderInput();
        }
    };

    window.mmDelete = () => {
        currentInput.pop();
        renderInput();
    };

    window.mmSubmit = () => {
        if (currentInput.length !== 4) return;

        document.getElementById('submit-btn').disabled = true;

        socket.emit('make_move', {
            roomId,
            move: { code: currentInput },
        });

        currentInput = [];
        renderInput();
    };

    const boardEl = document.getElementById('mm-board');
    const roleDisplay = document.getElementById('role-display');
    const statusEl = document.getElementById('mm-status');
    const secretDisplay = document.getElementById('secret-display');
    const secretSlots = document.getElementById('secret-slots');
    const inputSlots = document.querySelectorAll('#input-display .mm-slot');
    const submitBtn = document.getElementById('submit-btn');
    const controlsDiv = document.getElementById('mm-controls');
    const attemptsBox = document.getElementById('mm-attempts');
    const attemptsCount = document.getElementById('mm-attempts-count');
    const attemptsMax = document.getElementById('mm-attempts-max');

    function renderInput() {
        inputSlots.forEach((slot, i) => {
            slot.textContent = currentInput[i] !== undefined ? currentInput[i] : '';
        });
        submitBtn.disabled = currentInput.length !== 4;
    }

    function renderState(state) {
        const isMaker = state.makerIndex === playerIndex;
        const isBreaker = !isMaker;
        const myTurn = state.activePlayerIndex === playerIndex;

        roleDisplay.textContent = isMaker ? 'Role: MAKER (Set Code)' : 'Role: BREAKER (Guess Code)';

        if (
            (isMaker && state.secretCode && state.secretCode.length > 0) ||
            (state.isGameOver && state.secretCode)
        ) {
            secretDisplay.style.display = 'block';
            secretSlots.innerHTML = '';
            state.secretCode.forEach((d) => {
                const s = document.createElement('div');
                s.className = 'mm-slot';
                s.textContent = d;
                secretSlots.appendChild(s);
            });
        } else {
            secretDisplay.style.display = 'none';
        }

        if (state.phase === 'SETUP') {
            if (isMaker) {
                statusEl.textContent = 'Please set the secret code (4 digits)';
                controlsDiv.style.display = 'flex';
                submitBtn.textContent = 'Set Secret Code';
            } else {
                statusEl.textContent = 'Opponent is setting the secret code...';
                controlsDiv.style.display = 'none';
            }
            attemptsBox.style.display = 'none';
        } else {
            // Show attempt counter during play
            const used = state.guesses.length;
            const max = state.maxAttempts || 4;
            const remaining = max - used;
            attemptsBox.style.display = 'flex';
            attemptsCount.textContent = remaining;
            attemptsMax.textContent = max;
            attemptsBox.className = 'mm-attempts';
            if (remaining <= 1) attemptsBox.classList.add('danger');
            else if (remaining <= 2) attemptsBox.classList.add('warning');

            if (isBreaker) {
                statusEl.textContent = myTurn
                    ? `Your turn - ${remaining} guess${remaining === 1 ? '' : 'es'} left!`
                    : 'Waiting...';
                controlsDiv.style.display = 'flex';
                submitBtn.textContent = 'Submit Guess';
            } else {
                statusEl.textContent = `Opponent guessing (${remaining} left)`;
                controlsDiv.style.display = 'none';
            }
        }

        if (state.isGameOver) {
            controlsDiv.style.display = 'none';
            let msg = '';
            if (state.winner === playerIndex) msg = 'You Won!';
            else msg = 'You Lost!';

            if (typeof showStatus === 'function') showStatus(msg);
            statusEl.textContent = msg;
        }

        // Render Board (History)
        boardEl.innerHTML = '';

        state.guesses.forEach((guess) => {
            const row = document.createElement('div');
            row.className = 'mm-row';

            const codeDiv = document.createElement('div');
            codeDiv.className = 'mm-code-slots';

            guess.code.forEach((digit, i) => {
                const s = document.createElement('div');
                s.className = 'mm-slot';
                s.textContent = digit;

                if (guess.feedback && guess.feedback[i] !== undefined) {
                    if (guess.feedback[i] === 2) s.classList.add('correct');
                    else if (guess.feedback[i] === 1) s.classList.add('present');
                    else s.classList.add('absent');
                }

                codeDiv.appendChild(s);
            });

            row.appendChild(codeDiv);
            boardEl.appendChild(row);
        });

        boardEl.scrollTop = boardEl.scrollHeight;
    }

    // Init Render
    renderState(initialState);
    renderInput();

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (state) => {
        renderState(state);
    });
}
