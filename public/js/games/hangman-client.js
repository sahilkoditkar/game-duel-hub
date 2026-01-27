function initHangman(socket, gameArea, roomId, playerIndex, initialState) {
    console.log('Initializing Hangman for player', playerIndex);

    let gameState = initialState || {};

    // Basic HTML Structure
    gameArea.innerHTML = `
        <div class="hangman-container">
            <div class="stats-bar">
                <div class="stat-box">Lives: <span id="lives-count">${gameState.lives || 6}</span></div>
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
    const livesCount = document.getElementById('lives-count');
    const myScoreEl = document.getElementById('hm-my-score');
    const oppScoreEl = document.getElementById('hm-opp-score');

    // We do NOT update the global scoreboard here to avoid conflict with main.js logic

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

        // Update Stats
        livesCount.textContent = state.lives;

        // In-game scores
        myScoreEl.textContent = state.scores[playerIndex];
        oppScoreEl.textContent = state.scores[1 - playerIndex];

        // Update Turn Indicator
        if (state.activePlayerIndex === playerIndex) {
            turnIndicator.textContent = "Your Turn";
            turnIndicator.style.color = "#4ade80"; // Green
        } else {
            turnIndicator.textContent = "Opponent's Turn";
            turnIndicator.style.color = "#f87171"; // Red
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

            // Show revealed word
            if (state.revealedWord) {
                if (revealArea) revealArea.textContent = `The word was: ${state.revealedWord}`;
                msg += ` The word was: ${state.revealedWord}`;
            }

            // Trigger external modal logic
            if (typeof showStatus === 'function') {
                showStatus(msg);
            }

            // Disable all keys
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
    socket.off('game_state'); // Remove any old listeners
    socket.on('game_state', (state) => {
        renderState(state);
    });
}

// Add some styles dynamically for Hangman specific elements
const style = document.createElement('style');
style.textContent = `
    .hangman-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2rem;
        padding: 1rem;
    }
    .stats-bar {
        display: flex;
        gap: 2rem;
        font-size: 1.2rem;
        color: #e2e8f0;
        flex-wrap: wrap;
        justify-content: center;
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
        width: 40px;
        height: 50px;
        border-bottom: 3px solid #64748b;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
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
        .letter-box {
            width: 30px;
            height: 40px;
            font-size: 1.5rem;
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
        transition: background 0.2s;
    }
    .key-btn:hover:not(:disabled) {
        background: #475569;
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
`;
document.head.appendChild(style);
