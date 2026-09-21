const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Mancala = require('../games/mancala');

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}

function newGame(starter = 0) {
    return new Mancala('r', [fakeSocket('a'), fakeSocket('b')], starter);
}

function total(pits) {
    return pits.reduce((a, b) => a + b, 0);
}

describe('Mancala setup', () => {
    it('starts with 4 stones in each pit and empty stores', () => {
        const game = newGame();
        const s = game.getState();
        assert.deepEqual(s.pits, [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
        assert.deepEqual(s.stores, [0, 0]);
        assert.equal(s.lastMove, null);
        assert.equal(s.activePlayerIndex, 0);
        assert.equal(s.isGameOver, false);
        assert.equal(s.winner, null);
    });

    it('honors the starting player', () => {
        const game = newGame(1);
        assert.equal(game.makeMove(0, { pit: 0 }).valid, false);
        assert.equal(game.makeMove(1, { pit: 0 }).valid, true);
        assert.deepEqual(game.pits, [4, 4, 4, 4, 4, 4, 0, 0, 5, 5, 5, 5, 4, 0]);
        assert.equal(game.activePlayerIndex, 0);
    });

    it('getStateForPlayer matches public state (nothing hidden)', () => {
        const game = newGame();
        game.makeMove(0, { pit: 1 });
        assert.deepEqual(game.getStateForPlayer(0), game.getState());
        assert.deepEqual(game.getStateForPlayer(1), game.getState());
    });
});

describe('Mancala sowing', () => {
    it('sows one stone per pit counter-clockwise and passes the turn', () => {
        const game = newGame();
        const result = game.makeMove(0, { pit: 0 });
        assert.equal(result.valid, true);
        assert.deepEqual(game.pits, [0, 5, 5, 5, 5, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
        assert.equal(game.activePlayerIndex, 1);
        assert.deepEqual(game.lastMove, { player: 0, pit: 0, index: 0, captured: 0, extraTurn: false });
    });

    it('maps player 1 pit numbers onto indices 7-12', () => {
        const game = newGame(1);
        game.makeMove(1, { pit: 5 });
        // index 12 had 4 stones: 13 (own store), 0, 1, 2
        assert.deepEqual(game.pits, [5, 5, 5, 4, 4, 4, 0, 4, 4, 4, 4, 4, 0, 1]);
    });

    it('grants another turn when the last stone lands in your own store', () => {
        const game = newGame();
        game.makeMove(0, { pit: 2 }); // 4 stones -> 3, 4, 5, store
        assert.equal(game.pits[6], 1);
        assert.equal(game.activePlayerIndex, 0);
        assert.equal(game.lastMove.extraTurn, true);
        // and player 1 still cannot move
        assert.equal(game.makeMove(1, { pit: 0 }).valid, false);
        assert.equal(game.makeMove(0, { pit: 5 }).valid, true);
        assert.equal(game.activePlayerIndex, 1);
    });

    it('skips the opponent store when sowing around the board', () => {
        const game = newGame();
        game.pits = [4, 4, 4, 4, 4, 13, 0, 4, 4, 4, 4, 4, 4, 0];
        game.makeMove(0, { pit: 5 });
        // 13 stones: own store, 7..12 (6), skip 13, 0..5 (6). The last stone lands in the
        // emptied start pit, so the 5 stones opposite (index 7) are captured with it.
        assert.equal(game.pits[13], 0);
        assert.deepEqual(game.pits, [5, 5, 5, 5, 5, 0, 7, 0, 5, 5, 5, 5, 5, 0]);
        assert.equal(game.lastMove.captured, 6);
        assert.equal(total(game.pits), 57);
    });

    it('player 1 skips player 0 store when sowing around', () => {
        const game = newGame(1);
        game.pits = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 13, 0];
        game.makeMove(1, { pit: 5 });
        assert.equal(game.pits[6], 0);
        assert.deepEqual(game.pits, [0, 5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5, 0, 7]);
        assert.equal(game.lastMove.captured, 6);
    });

    it('conserves the total number of stones', () => {
        const game = newGame();
        game.makeMove(0, { pit: 3 });
        game.makeMove(1, { pit: 1 });
        assert.equal(total(game.pits), 48);
    });
});

describe('Mancala captures', () => {
    it('captures the opposite pit when the last stone lands in an empty own pit', () => {
        const game = newGame();
        game.pits = [1, 0, 4, 4, 4, 4, 0, 4, 4, 4, 4, 5, 4, 0];
        game.makeMove(0, { pit: 0 }); // lands in index 1 (empty), opposite is 11 with 5
        assert.equal(game.pits[1], 0);
        assert.equal(game.pits[11], 0);
        assert.equal(game.pits[6], 6);
        assert.equal(game.lastMove.captured, 6);
        assert.equal(game.activePlayerIndex, 1);
        assert.equal(total(game.pits), 42);
    });

    it('player 1 captures across into their own store', () => {
        const game = newGame(1);
        game.pits = [4, 4, 4, 3, 4, 4, 0, 4, 1, 0, 4, 4, 4, 0];
        game.makeMove(1, { pit: 1 }); // index 8 -> lands in 9 (empty), opposite is 3 with 3
        assert.equal(game.pits[9], 0);
        assert.equal(game.pits[3], 0);
        assert.equal(game.pits[13], 4);
        assert.equal(game.lastMove.captured, 4);
    });

    it('does not capture when the opposite pit is empty', () => {
        const game = newGame();
        game.pits = [1, 0, 4, 4, 4, 4, 0, 4, 4, 4, 4, 0, 4, 0];
        game.makeMove(0, { pit: 0 });
        assert.equal(game.pits[1], 1);
        assert.equal(game.pits[6], 0);
        assert.equal(game.lastMove.captured, 0);
    });

    it('does not capture when landing in an empty pit on the opponent side', () => {
        const game = newGame();
        game.pits = [4, 4, 4, 4, 4, 2, 0, 0, 4, 4, 4, 4, 4, 0];
        game.makeMove(0, { pit: 5 }); // store, then index 7 which was empty
        assert.equal(game.pits[7], 1);
        assert.equal(game.pits[6], 1);
        assert.equal(game.lastMove.captured, 0);
        assert.equal(game.activePlayerIndex, 1);
    });

    it('does not capture when landing in a non-empty own pit', () => {
        const game = newGame();
        game.makeMove(0, { pit: 0 }); // ends in index 4 which already had stones
        assert.equal(game.lastMove.captured, 0);
        assert.equal(game.pits[6], 0);
    });
});

describe('Mancala game end', () => {
    it('ends when the mover empties their side and sweeps the opponent stones', () => {
        const game = newGame();
        game.pits = [0, 0, 0, 0, 0, 1, 20, 3, 3, 3, 3, 3, 3, 9];
        game.makeMove(0, { pit: 5 });
        assert.equal(game.isGameOver, true);
        assert.deepEqual(game.pits.slice(0, 6), [0, 0, 0, 0, 0, 0]);
        assert.deepEqual(game.pits.slice(7, 13), [0, 0, 0, 0, 0, 0]);
        assert.equal(game.pits[6], 21);
        assert.equal(game.pits[13], 27);
        assert.equal(game.winner, 1);
        assert.equal(total(game.pits), 48);
    });

    it('ends when the move empties the opponent side (by capture)', () => {
        const game = newGame();
        game.pits = [1, 0, 5, 5, 5, 5, 10, 0, 0, 0, 0, 5, 0, 12];
        game.makeMove(0, { pit: 0 }); // capture index 11 -> opponent side now empty
        assert.equal(game.isGameOver, true);
        assert.equal(game.pits[6], 10 + 6 + 20);
        assert.equal(game.pits[13], 12);
        assert.equal(game.winner, 0);
    });

    it('does not grant an extra turn when the ending move lands in the store', () => {
        const game = newGame();
        game.pits = [0, 0, 0, 0, 0, 1, 5, 4, 4, 4, 4, 4, 4, 0];
        game.makeMove(0, { pit: 5 });
        assert.equal(game.isGameOver, true);
        assert.equal(game.lastMove.extraTurn, true);
        assert.equal(game.makeMove(0, { pit: 0 }).valid, false);
        assert.equal(game.winner, 1);
    });

    it('declares a draw when both stores are equal', () => {
        const game = newGame();
        game.pits = [0, 0, 0, 0, 0, 1, 23, 0, 0, 0, 0, 0, 4, 20];
        game.makeMove(0, { pit: 5 });
        assert.equal(game.isGameOver, true);
        assert.deepEqual([game.pits[6], game.pits[13]], [24, 24]);
        assert.equal(game.winner, 'draw');
    });

    it('plays a full legal game to completion with all 48 stones accounted for', () => {
        const game = newGame();
        let moves = 0;
        while (!game.isGameOver && moves < 500) {
            const p = game.activePlayerIndex;
            let played = false;
            // Prefer the pit that lands in the store, otherwise the first non-empty pit.
            for (let pit = 5; pit >= 0 && !played; pit--) {
                const idx = p * 7 + pit;
                if (game.pits[idx] > 0 && game.pits[idx] === 6 - pit) {
                    played = game.makeMove(p, { pit }).valid;
                }
            }
            for (let pit = 0; pit < 6 && !played; pit++) {
                if (game.pits[p * 7 + pit] > 0) {
                    played = game.makeMove(p, { pit }).valid;
                }
            }
            assert.equal(played, true, 'active player must always have a legal move');
            moves++;
        }
        assert.equal(game.isGameOver, true);
        assert.equal(total(game.pits), 48);
        assert.equal(game.pits[6] + game.pits[13], 48);
        assert.ok([0, 1, 'draw'].includes(game.winner));
        if (game.winner === 'draw') assert.equal(game.pits[6], game.pits[13]);
        else assert.ok(game.pits[game.winner === 0 ? 6 : 13] > game.pits[game.winner === 0 ? 13 : 6]);
    });

    it('rejects moves after the game is over', () => {
        const game = newGame();
        game.pits = [0, 0, 0, 0, 0, 1, 5, 4, 4, 4, 4, 4, 4, 0];
        game.makeMove(0, { pit: 5 });
        assert.equal(game.makeMove(1, { pit: 0 }).valid, false);
    });
});

describe('Mancala rejects bad moves without throwing', () => {
    const bad = [
        undefined, null, 'nope', 3, [],
        {}, { pit: 1.5 }, { pit: '2' }, { pit: -1 }, { pit: 6 }, { pit: 13 },
        { pit: NaN }, { pit: null }, { pit: true }, { pit: [2] }
    ];
    for (const move of bad) {
        it(`rejects ${JSON.stringify(move)}`, () => {
            const game = newGame();
            let result;
            assert.doesNotThrow(() => { result = game.makeMove(0, move); });
            assert.equal(result.valid, false);
            assert.equal(typeof result.message, 'string');
            assert.deepEqual(game.pits, [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
            assert.equal(game.activePlayerIndex, 0);
        });
    }

    it('rejects a move by the wrong player', () => {
        const game = newGame();
        const result = game.makeMove(1, { pit: 0 });
        assert.equal(result.valid, false);
        assert.equal(result.message, 'Not your turn');
    });

    it('rejects selecting an empty pit and keeps the turn', () => {
        const game = newGame();
        game.makeMove(0, { pit: 2 }); // extra turn, pit 2 now empty
        const result = game.makeMove(0, { pit: 2 });
        assert.equal(result.valid, false);
        assert.equal(game.activePlayerIndex, 0);
        assert.equal(game.pits[2], 0);
    });
});
