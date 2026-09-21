const BaseGame = require('./base-game');

// Sim: six dots, fifteen edges. Players alternate coloring an edge; whoever completes a
// triangle in their own color loses. Ramsey's theorem (R(3,3)=6) means a draw cannot happen.
class Sim extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.dots = 6;
        this.totalEdges = 15;
        // owner[a][b] === owner[b][a] === null | 0 | 1
        this.owner = Array.from({ length: this.dots }, () => Array(this.dots).fill(null));
        this.edges = []; // taken edges in order: { a, b, owner }
        this.losingTriangle = null;
        this.lastMove = null;
    }

    makeMove(playerIndex, move) {
        if (this.isGameOver) {
            return { valid: false, message: "Game is over" };
        }
        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: "Not your turn" };
        }
        if (!move || typeof move !== 'object') {
            return { valid: false, message: "Invalid move" };
        }
        let { a, b } = move;
        if (!BaseGame.isIntInRange(a, 0, this.dots - 1) || !BaseGame.isIntInRange(b, 0, this.dots - 1)) {
            return { valid: false, message: "Pick two dots" };
        }
        if (a === b) {
            return { valid: false, message: "Pick two different dots" };
        }
        if (a > b) [a, b] = [b, a];
        if (this.owner[a][b] !== null) {
            return { valid: false, message: "That line is already taken" };
        }

        this.owner[a][b] = playerIndex;
        this.owner[b][a] = playerIndex;
        this.edges.push({ a, b, owner: playerIndex });
        this.lastMove = { a, b, owner: playerIndex };

        const triangle = this.findTriangle(a, b, playerIndex);
        if (triangle) {
            this.losingTriangle = triangle;
            this.isGameOver = true;
            this.winner = 1 - playerIndex; // completing your own triangle loses
        } else if (this.edges.length >= this.totalEdges) {
            // Unreachable by Ramsey theory, kept as a defensive guard.
            this.isGameOver = true;
            this.winner = 'draw';
        } else {
            this.switchTurn();
        }

        this.emitState();
        return { valid: true };
    }

    // Does edge (a,b) close a triangle of `player`'s color with some third dot c?
    findTriangle(a, b, player) {
        for (let c = 0; c < this.dots; c++) {
            if (c === a || c === b) continue;
            if (this.owner[a][c] === player && this.owner[b][c] === player) {
                return [a, b, c].sort((x, y) => x - y);
            }
        }
        return null;
    }

    getState() {
        return {
            dots: this.dots,
            edges: this.edges.map(e => ({ ...e })),
            matrix: this.owner.map(row => [...row]),
            lastMove: this.lastMove ? { ...this.lastMove } : null,
            losingTriangle: this.losingTriangle ? [...this.losingTriangle] : null,
            edgesLeft: this.totalEdges - this.edges.length,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = Sim;
