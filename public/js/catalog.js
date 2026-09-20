// Single source of truth for the game list. Loaded by the server (require) and the
// browser (script tag). Add a game here, plus games/<id>.js and public/js/games/<id>-client.js.
(function (root) {
    const CATEGORIES = [
        { id: 'board', label: 'Board Strategy', icon: '♟', blurb: 'Turn-based classics on a grid' },
        { id: 'logic', label: 'Puzzle & Logic', icon: '🧩', blurb: 'Outthink your opponent' },
        { id: 'words', label: 'Words & Trivia', icon: '🔤', blurb: 'Vocabulary, speed and knowledge' },
        { id: 'dice', label: 'Dice & Cards', icon: '🎲', blurb: 'A little luck, a little nerve' },
        { id: 'quick', label: 'Quick Duels', icon: '⚡', blurb: 'Fast rounds, instant rematches' }
    ];

    // clientInit is the global function the client script defines.
    // special marks games whose constructor needs extra arguments from the GameManager.
    // timed games implement start()/pause()/resume() on the server.
    const GAMES = [
        // Board Strategy
        { id: 'tictactoe', label: 'Tic-Tac-Toe', category: 'board', tagline: 'Three in a row', clientInit: 'initTicTacToe' },
        { id: 'connectfour', label: 'Connect Four', category: 'board', tagline: 'Drop discs, line up four', clientInit: 'initConnectFour' },
        { id: 'gomoku', label: 'Gomoku', category: 'board', tagline: 'Five in a row on a 15x15 board', clientInit: 'initGomoku' },
        { id: 'ultimatettt', label: 'Ultimate Tic-Tac-Toe', category: 'board', tagline: 'Nine boards, one winner', clientInit: 'initUltimateTtt' },
        { id: 'reversi', label: 'Reversi', category: 'board', tagline: 'Flip discs to claim the board', clientInit: 'initReversi' },
        { id: 'checkers', label: 'Checkers', category: 'board', tagline: 'Jump and capture', clientInit: 'initCheckers' },
        { id: 'mancala', label: 'Mancala', category: 'board', tagline: 'Sow stones, capture pits', clientInit: 'initMancala' },

        // Puzzle & Logic
        { id: 'dotsandboxes', label: 'Dots and Boxes', category: 'logic', tagline: 'Close boxes to score', clientInit: 'initDotsAndBoxes' },
        { id: 'sim', label: 'Sim', category: 'logic', tagline: 'Draw lines, avoid your own triangle', clientInit: 'initSim' },
        { id: 'nim', label: 'Nim', category: 'logic', tagline: 'Take stones, last to take loses', clientInit: 'initNim' },
        { id: 'chomp', label: 'Chomp', category: 'logic', tagline: 'Bite the bar, dodge the poison', clientInit: 'initChomp' },
        { id: 'mastermind', label: 'Mastermind', category: 'logic', tagline: 'Crack the 4-digit code', clientInit: 'initMastermind', special: 'mastermind' },
        { id: 'battleship', label: 'Battleship', category: 'logic', tagline: 'Sink the hidden fleet', clientInit: 'initBattleship' },
        { id: 'memory', label: 'Memory Match', category: 'logic', tagline: 'Find the pairs', clientInit: 'initMemory' },

        // Words & Trivia
        { id: 'hangman', label: 'Hangman', category: 'words', tagline: 'Guess the word letter by letter', clientInit: 'initHangman', special: 'hangman' },
        { id: 'wordchain', label: 'Word Chain', category: 'words', tagline: 'Last letter starts the next word', clientInit: 'initWordChain', special: 'wordchain' },
        { id: 'wordle', label: 'Wordle Race', category: 'words', tagline: 'Same secret word, first to solve wins', clientInit: 'initWordle' },
        { id: 'anagram', label: 'Anagram Duel', category: 'words', tagline: 'Most words from 9 letters in 60s', clientInit: 'initAnagram' },
        { id: 'typing', label: 'Typing Race', category: 'words', tagline: 'Type the sentence first', clientInit: 'initTyping' },
        { id: 'trivia', label: 'Trivia Duel', category: 'words', tagline: 'Ten questions, most right wins', clientInit: 'initTrivia' },

        // Dice & Cards
        { id: 'snakes', label: 'Snakes and Ladders', category: 'dice', tagline: 'Race to 100', clientInit: 'initSnakes' },
        { id: 'pig', label: 'Pig', category: 'dice', tagline: 'Roll or hold, first to 50', clientInit: 'initPig' },
        { id: 'blackjack', label: 'Blackjack', category: 'dice', tagline: 'Beat the dealer, beat your rival', clientInit: 'initBlackjack' },
        { id: 'bingo', label: 'Bingo', category: 'dice', tagline: 'Five lines to shout BINGO', clientInit: 'initBingo' },

        // Quick Duels
        { id: 'rps', label: 'Rock Paper Scissors', category: 'quick', tagline: 'Best of three', clientInit: 'initRps' },
        { id: 'speedmath', label: 'Speed Math', category: 'quick', tagline: 'First correct answer wins the round', clientInit: 'initSpeedMath' }
    ];

    const CATALOG = { CATEGORIES, GAMES };
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CATALOG;
    } else {
        root.GAME_CATALOG = CATALOG;
    }
})(typeof window !== 'undefined' ? window : this);
