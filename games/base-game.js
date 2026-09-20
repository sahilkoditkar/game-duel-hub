class BaseGame {
    constructor(id, players, startingPlayerIndex = 0) {
        this.id = id;
        this.players = players; // Array of socket objects
        this.gameState = {};
        this.activePlayerIndex = startingPlayerIndex; // 0 or 1
        this.isGameOver = false;
        this.winner = null;
        this.onGameOver = null;
        this._gameOverNotified = false;
    }

    // Abstract method: handle player move
    makeMove(playerIndex, move) {
        throw new Error("Method 'makeMove' must be implemented.");
    }

    // True when value is an integer within [min, max]. Rejects strings, floats, undefined.
    static isIntInRange(value, min, max) {
        return Number.isInteger(value) && value >= min && value <= max;
    }

    // Check if it's player's turn
    isTurn(playerIndex) {
        return playerIndex === this.activePlayerIndex;
    }

    // Switch turn
    switchTurn() {
        this.activePlayerIndex = 1 - this.activePlayerIndex;
    }

    // Get public game state for clients
    getState() {
        return {
            id: this.id,
            players: this.players.map(p => p.id),
            gameState: this.gameState,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }

    // Per-player view (hide secrets). Defaults to public state.
    getStateForPlayer(_playerIndex) {
        return this.getState();
    }

    broadcast(event, data) {
        this.players.forEach(p => p.emit(event, data));
    }

    emitState() {
        this.players.forEach((p, index) => {
            p.emit('game_state', this.getStateForPlayer(index));
        });
        this.notifyGameOver();
    }

    notifyGameOver() {
        if (this.isGameOver && !this._gameOverNotified && typeof this.onGameOver === 'function') {
            this._gameOverNotified = true;
            this.onGameOver();
        }
    }
}

module.exports = BaseGame;
