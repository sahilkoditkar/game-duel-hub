class BaseGame {
    constructor(id, players) {
        this.id = id;
        this.players = players; // Array of socket objects
        this.gameState = {};
        this.activePlayerIndex = 0; // 0 or 1
        this.isGameOver = false;
        this.winner = null;
    }

    // Abstract method: handle player move
    makeMove(playerIndex, move) {
        throw new Error("Method 'makeMove' must be implemented.");
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

    broadcast(event, data) {
        this.players.forEach(p => p.emit(event, data));
    }

    emitState() {
        this.broadcast('game_state', this.getState());
    }
}

module.exports = BaseGame;
