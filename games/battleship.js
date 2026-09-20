const BaseGame = require('./base-game');

class Battleship extends BaseGame {
    constructor(roomId, players, startingPlayerIndex) {
        super(roomId, players, startingPlayerIndex);
        this.size = 10;

        // 0: Water, 1: Ship, 2: Miss, 3: Hit
        this.grids = [
            this.createGrid(),
            this.createGrid()
        ];

        // Ships config: Size
        this.shipsToPlace = [5, 4, 3, 3, 2];

        // Initialize boards
        this.placeRandomShips(0);
        this.placeRandomShips(1);

        // this.activePlayerIndex is set by BaseGame
        this.isGameOver = false;
        this.winner = null;
        this.scores = [0, 0]; // Ships sunk
    }

    // ... (methods skipped, targeting makeMove below)

    makeMove(playerIndex, move) {
        // move: { row, col }
        if (this.isGameOver) return { valid: false, message: 'Game is over' };
        if (playerIndex !== this.activePlayerIndex) return { valid: false, message: 'Not your turn' };

        const { row, col } = move;
        const opponentIndex = 1 - playerIndex;
        const oppGrid = this.grids[opponentIndex];

        if (!BaseGame.isIntInRange(row, 0, 9) || !BaseGame.isIntInRange(col, 0, 9)) return { valid: false, message: 'Invalid coordinates' };

        const cell = oppGrid[row][col];
        if (cell === 2 || cell === 3) return { valid: false, message: 'Already fired here' };

        let hit = false;
        // Update Hit (3) or Miss (2)
        if (cell === 1) {
            oppGrid[row][col] = 3; // Hit
            hit = true;
        } else {
            oppGrid[row][col] = 2; // Miss
        }

        this.checkWin();

        // Streak Mechanic:
        // If Hit, activePlayerIndex stays the same.
        // If Miss, switch to opponent.
        if (!hit && !this.isGameOver) {
            this.activePlayerIndex = opponentIndex;
        }

        this.emitState();
        return { valid: true };
    }

    createGrid() {
        return Array(10).fill(null).map(() => Array(10).fill(0));
    }

    placeRandomShips(playerIndex) {
        // Retry the entire layout if any ship fails to place, since
        // a partial layout could leave a ship missing.
        for (let attempt = 0; attempt < 20; attempt++) {
            const grid = this.createGrid();
            let allPlaced = true;

            for (const size of this.shipsToPlace) {
                let placed = false;
                for (let i = 0; i < 200; i++) {
                    const horizontal = Math.random() < 0.5;
                    const row = Math.floor(Math.random() * 10);
                    const col = Math.floor(Math.random() * 10);

                    if (this.canPlace(grid, row, col, size, horizontal)) {
                        this.placeShip(grid, row, col, size, horizontal);
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    allPlaced = false;
                    break;
                }
            }

            if (allPlaced) {
                this.grids[playerIndex] = grid;
                return;
            }
        }

        // Should be statistically impossible with these ship sizes on a 10x10 board
        console.error('Battleship: failed to place all ships after 20 layout attempts');
    }

    canPlace(grid, row, col, size, horizontal) {
        if (horizontal) {
            if (col + size > 10) return false;
            for (let i = 0; i < size; i++) {
                if (grid[row][col + i] !== 0) return false;
            }
        } else {
            if (row + size > 10) return false;
            for (let i = 0; i < size; i++) {
                if (grid[row + i][col] !== 0) return false;
            }
        }
        return true;
    }

    placeShip(grid, row, col, size, horizontal) {
        if (horizontal) {
            for (let i = 0; i < size; i++) grid[row][col + i] = 1;
        } else {
            for (let i = 0; i < size; i++) grid[row + i][col] = 1;
        }
    }



    checkWin() {
        // Check if all ships (1s) are gone (turned to 3s)
        // Actually we just check if any '1' remains in grid

        const p0HasShips = this.grids[0].some(row => row.includes(1));
        const p1HasShips = this.grids[1].some(row => row.includes(1));

        if (!p0HasShips) {
            this.isGameOver = true;
            this.winner = 1; // P0 lost
        } else if (!p1HasShips) {
            this.isGameOver = true;
            this.winner = 0; // P1 lost
        }

        // Optional: Can update 'scores' to be sunken ships count for display, 
        // but finding sunk ships is slightly more complex logic here.
        // For now, let's just stick to win/loss.
    }

    hideShips(grid) {
        return grid.map(row => row.map(cell => (cell === 1 ? 0 : cell)));
    }

    getState() {
        return {
            grids: this.grids,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }

    getStateForPlayer(playerIndex) {
        return {
            grids: this.grids.map((grid, i) => (
                i === playerIndex ? grid : this.hideShips(grid)
            )),
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = Battleship;
