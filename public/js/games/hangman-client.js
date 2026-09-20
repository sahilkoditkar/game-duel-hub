function initHangman(socket, gameArea, roomId, playerIndex, initialState) {
    console.log('Initializing Hangman for player', playerIndex);

    let gameState = initialState || {};

    // Basic HTML Structure
    gameArea.innerHTML = `
        <div class="hangman-container">
            <div class="stats-bar">
                <div class="stat-box">My Lives: <span id="my-lives" class="hm-lives">6</span></div>
                <div class="stat-box">Opp Lives: <span id="opp-lives" class="hm-lives">6</span></div>
            </div>
            <div class="stats-bar">
                <div class="stat-box">My Score: <span id="hm-my-score">0</span></div>
                <div class="stat-box">Opp Score: <span id="hm-opp-score">0</span></div>
            </div>
            <div class="stat-box">Turn: <span id="turn-indicator">...</span></div>

            <div class="word-display" id="word-display">
                <!-- Letters/Underscores go here -->
            </div>

            <div id="reveal-area" class="reveal-area"></div>

            <div class="keyboard" id="keyboard">
                <!-- A-Z buttons -->
            </div>
        </div>
    `;

    const turnIndicator = document.getElementById('turn-indicator');
    const wordDisplay = document.getElementById('word-display');
    const revealArea = document.getElementById('reveal-area');
    const keyboard = document.getElementById('keyboard');
    const myLivesEl = document.getElementById('my-lives');
    const oppLivesEl = document.getElementById('opp-lives');
    const myScoreEl = document.getElementById('hm-my-score');
    const oppScoreEl = document.getElementById('hm-opp-score');

    // Generate Keyboard
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    alphabet.split('').forEach(letter => {
        const btn = document.createElement('button');
        btn.textContent = letter;
        btn.className = 'key-btn';
        btn.id = `key-${letter}`;
        btn.onclick = () => handleGuess(letter);
        keyboard.appendChild(btn);
    });

    function renderState(state) {
        gameState = state;

        // Update Stats - per-player lives
        const lives = state.lives || [6, 6];
        const myLives = lives[playerIndex];
        const oppLives = lives[1 - playerIndex];
        myLivesEl.textContent = '\u2764'.repeat(myLives) || '0';
        oppLivesEl.textContent = '\u2764'.repeat(oppLives) || '0';
        myLivesEl.className = 'hm-lives' + (myLives <= 2 ? ' low' : '');
        oppLivesEl.className = 'hm-lives' + (oppLives <= 2 ? ' low' : '');

        // In-game scores
        myScoreEl.textContent = state.scores[playerIndex];
        oppScoreEl.textContent = state.scores[1 - playerIndex];

        // Update Turn Indicator
        if (state.activePlayerIndex === playerIndex) {
            turnIndicator.textContent = "Your Turn";
            turnIndicator.style.color = "#4ade80";
        } else {
            turnIndicator.textContent = "Opponent's Turn";
            turnIndicator.style.color = "#f87171";
        }

        // Update Word Display
        wordDisplay.innerHTML = '';
        state.maskedWord.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.className = 'letter-box';
            wordDisplay.appendChild(span);
        });

        // Update Keyboard (disable guessed letters)
        const keys = document.querySelectorAll('.key-btn');
        keys.forEach(key => {
            if (state.guessedLetters.includes(key.textContent)) {
                key.disabled = true;
                key.classList.add('used');
            } else {
                key.disabled = state.activePlayerIndex !== playerIndex;
                key.classList.remove('used');
            }
        });

        // Game Over Logic
        if (state.isGameOver) {
            let msg = '';
            if (state.winner === 'draw') {
                msg = 'Draw - Tie!';
            } else if (state.winner === playerIndex) {
                msg = 'You Won!';
            } else {
                msg = 'You Lost!';
            }

            if (state.revealedWord) {
                if (revealArea) revealArea.textContent = `The word was: ${state.revealedWord}`;
                msg += ` The word was: ${state.revealedWord}`;
            }

            if (typeof showStatus === 'function') {
                showStatus(msg);
            }

            keys.forEach(k => k.disabled = true);
        } else {
            if (revealArea) revealArea.textContent = '';
        }
    }

    function handleGuess(letter) {
        if (gameState.activePlayerIndex !== playerIndex) return;
        socket.emit('make_move', { roomId, move: { letter } });
    }

    // Initial Render
    renderState(initialState);

    // Socket Listener
    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (state) => {
        renderState(state);
    });
    socket.on('invalid_move', (msg) => { if (typeof showToast === 'function') showToast(msg); else alert(msg); });
}

// Add some styles dynamically for Hangman specific elements
(function() {
    const oldStyle = document.getElementById('hangman-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'hangman-styles';
    style.textContent = `
        .hangman-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2rem;
            padding: 1rem;
            user-select: none;
        }
        .stats-bar {
            display: flex;
            gap: 2rem;
            font-size: 1.2rem;
            color: #e2e8f0;
            flex-wrap: wrap;
            justify-content: center;
        }
        .hm-lives {
            color: #ef4444;
            letter-spacing: 2px;
            font-size: 0.9rem;
        }
        .hm-lives.low {
            animation: pulse 0.8s infinite alternate;
        }
        .word-display {
            display: flex;
            gap: 0.5rem;
            margin: 2rem 0;
            flex-wrap: wrap;
            justify-content: center;
        }
        .reveal-area {
            font-size: 1.5rem;
            color: #fbbf24;
            margin-bottom: 1rem;
            font-weight: bold;
            min-height: 2rem;
            text-align: center;
        }
        .letter-box {
            width: clamp(28px, 7vw, 44px);
            height: clamp(36px, 9vw, 54px);
            border-bottom: 3px solid #64748b;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: clamp(1.3rem, 4vw, 2rem);
            font-family: monospace;
            color: #f1f5f9;
        }
        .keyboard {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 0.5rem;
            max-width: 600px;
            width: 100%;
        }
        @media (max-width: 500px) {
            .keyboard {
                 grid-template-columns: repeat(5, 1fr);
            }
        }
        .key-btn {
            padding: 10px;
            font-size: 1.2rem;
            background: #334155;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            touch-action: manipulation;
        }
        .key-btn:active:not(:disabled) {
            transform: scale(0.92);
        }
        .key-btn:disabled {
            background: #1e293b;
            color: #64748b;
            cursor: not-allowed;
            opacity: 0.6;
        }
        .key-btn.used {
            background: #0f172a;
        }
        @media (hover: hover) {
            .key-btn:hover:not(:disabled) {
                background: #475569;
            }
        }
    `;
    document.head.appendChild(style);
})();
