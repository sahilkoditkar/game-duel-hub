const BaseGame = require('./base-game');

class Checkers extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        // 8x8 board: null = empty, { player: 0/1, king: false }
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));

        // Place pieces: player 0 at top (rows 0-2), player 1 at bottom (rows 5-7)
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 8; c++) {
                if ((r + c) % 2 === 1) {
                    board[r][c] = { player: 0, king: false };
                }
            }
        }
        for (let r = 5; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if ((r + c) % 2 === 1) {
                    board[r][c] = { player: 1, king: false };
                }
            }
        }

        this.gameState = {
            board,
            mustContinue: null, // { row, col } if mid-multi-jump
        };
    }

    makeMove(playerIndex, moveData) {
        const { fromRow, fromCol, toRow, toCol } = moveData;

        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: 'Not your turn' };
        }
        if (this.isGameOver) {
            return { valid: false, message: 'Game is over' };
        }

        const board = this.gameState.board;
        const piece = board[fromRow] && board[fromRow][fromCol];

        if (!piece || piece.player !== playerIndex) {
            return { valid: false, message: 'Not your piece' };
        }

        // If must continue multi-jump, can only move that piece
        if (this.gameState.mustContinue) {
            const mc = this.gameState.mustContinue;
            if (fromRow !== mc.row || fromCol !== mc.col) {
                return { valid: false, message: 'Must continue jumping with the same piece' };
            }
        }

        // Validate move
        const dr = toRow - fromRow;
        const dc = toCol - fromCol;
        const absDr = Math.abs(dr);
        const absDc = Math.abs(dc);

        if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) {
            return { valid: false, message: 'Out of bounds' };
        }
        if (board[toRow][toCol] !== null) {
            return { valid: false, message: 'Square occupied' };
        }

        // Direction check (non-kings can only move forward)
        const forwardDir = playerIndex === 0 ? 1 : -1;
        const isForward = (dr > 0 && forwardDir > 0) || (dr < 0 && forwardDir < 0);

        // Check if there are captures available
        const allCaptures = this.getAllCaptures(playerIndex);
        const hasCaptures = allCaptures.length > 0;

        if (absDr === 1 && absDc === 1) {
            // Simple move
            if (hasCaptures) {
                return { valid: false, message: 'You must capture when possible' };
            }
            if (this.gameState.mustContinue) {
                return { valid: false, message: 'Must continue jumping' };
            }
            if (!piece.king && !isForward) {
                return { valid: false, message: 'Regular pieces can only move forward' };
            }

            board[toRow][toCol] = piece;
            board[fromRow][fromCol] = null;
            this.gameState.mustContinue = null;

            // King promotion
            this.checkPromotion(toRow, toCol);
            this.switchTurn();
        } else if (absDr === 2 && absDc === 2) {
            // Jump/capture
            if (!piece.king && !isForward) {
                return { valid: false, message: 'Regular pieces can only jump forward' };
            }

            const midR = fromRow + dr / 2;
            const midC = fromCol + dc / 2;
            const midPiece = board[midR][midC];

            if (!midPiece || midPiece.player === playerIndex) {
                return { valid: false, message: 'No opponent piece to capture' };
            }

            // Execute capture
            board[toRow][toCol] = piece;
            board[fromRow][fromCol] = null;
            board[midR][midC] = null;

            // King promotion
            this.checkPromotion(toRow, toCol);

            // Check for more captures from landing spot
            const moreCaptures = this.getPieceCaptures(toRow, toCol, playerIndex);
            if (moreCaptures.length > 0) {
                this.gameState.mustContinue = { row: toRow, col: toCol };
            } else {
                this.gameState.mustContinue = null;
                this.switchTurn();
            }
        } else {
            return { valid: false, message: 'Invalid move' };
        }

        // Check win conditions
        this.checkGameOver();
        this.emitState();
        return { valid: true };
    }

    checkPromotion(row, col) {
        const piece = this.gameState.board[row][col];
        if (!piece) return;
        if (piece.player === 0 && row === 7) piece.king = true;
        if (piece.player === 1 && row === 0) piece.king = true;
    }

    getPieceCaptures(row, col, player) {
        const board = this.gameState.board;
        const piece = board[row][col];
        if (!piece) return [];

        const captures = [];
        const dirs = piece.king
            ? [
                  [-2, -2],
                  [-2, 2],
                  [2, -2],
                  [2, 2],
              ]
            : player === 0
              ? [
                    [2, -2],
                    [2, 2],
                ]
              : [
                    [-2, -2],
                    [-2, 2],
                ];

        for (const [dr, dc] of dirs) {
            const tr = row + dr;
            const tc = col + dc;
            const mr = row + dr / 2;
            const mc = col + dc / 2;

            if (
                tr >= 0 &&
                tr < 8 &&
                tc >= 0 &&
                tc < 8 &&
                board[tr][tc] === null &&
                board[mr][mc] &&
                board[mr][mc].player !== player
            ) {
                captures.push({ fromRow: row, fromCol: col, toRow: tr, toCol: tc });
            }
        }
        return captures;
    }

    getAllCaptures(player) {
        const captures = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.gameState.board[r][c];
                if (piece && piece.player === player) {
                    captures.push(...this.getPieceCaptures(r, c, player));
                }
            }
        }
        return captures;
    }

    getValidMoves(player) {
        const moves = [];
        const captures = this.getAllCaptures(player);

        if (captures.length > 0) return captures;

        const board = this.gameState.board;
        const forwardDir = player === 0 ? 1 : -1;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (!piece || piece.player !== player) continue;

                const dirs = piece.king
                    ? [
                          [-1, -1],
                          [-1, 1],
                          [1, -1],
                          [1, 1],
                      ]
                    : [
                          [forwardDir, -1],
                          [forwardDir, 1],
                      ];

                for (const [dr, dc] of dirs) {
                    const tr = r + dr;
                    const tc = c + dc;
                    if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8 && board[tr][tc] === null) {
                        moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
                    }
                }
            }
        }
        return moves;
    }

    checkGameOver() {
        for (let p = 0; p < 2; p++) {
            const moves = this.getValidMoves(p);
            const captures = this.getAllCaptures(p);
            if (moves.length === 0 && captures.length === 0) {
                this.isGameOver = true;
                this.winner = 1 - p;
                return;
            }
        }
    }

    getState() {
        // Serialize board
        const board = this.gameState.board.map((row) =>
            row.map((cell) => (cell ? { player: cell.player, king: cell.king } : null))
        );

        const validMoves = this.isGameOver
            ? []
            : this.gameState.mustContinue
              ? this.getPieceCaptures(
                    this.gameState.mustContinue.row,
                    this.gameState.mustContinue.col,
                    this.activePlayerIndex
                )
              : this.getValidMoves(this.activePlayerIndex);

        return {
            board,
            validMoves,
            mustContinue: this.gameState.mustContinue,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner,
        };
    }
}

module.exports = Checkers;
