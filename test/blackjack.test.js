const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Blackjack = require('../games/blackjack');
const { handTotal, freshDeck } = Blackjack;

function fakeSocket(id) {
    return { id, emit() {}, join() {}, leave() {} };
}
const sockets = () => [fakeSocket('a'), fakeSocket('b')];

// Shorthand: c('A') is A♠, c('10', 'h') is 10♥.
const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
function c(rank, suit = 's') {
    return { rank, suit: SUIT[suit] };
}

// Deal order: p0, p0, p1, p1, dealer up, dealer hole, then hits/dealer draws in order.
function gameWithDecks(decks, starting = 0) {
    let call = 0;
    const factory = () => {
        const d = decks[Math.min(call, decks.length - 1)];
        call++;
        return d.slice();
    };
    return new Blackjack('r', sockets(), starting, { deckFactory: factory });
}

// p0 17 (stands), p1 16 hits to 18, dealer 16 draws to 20: p1 loses less badly? no: both lose to 20 -> higher total wins (p1).
const ROUND_P1_WINS = [c('10'), c('7'), c('10', 'h'), c('6', 'h'), c('10', 'd'), c('6', 'd'), c('2', 'c'), c('4', 'c')];
// p0 20 stands, p1 19 stands, dealer 10+8 = 18: p0 wins, p1 wins, p0 higher -> p0 round.
const ROUND_P0_WINS = [c('10'), c('Q'), c('10', 'h'), c('9', 'h'), c('10', 'd'), c('8', 'd'), c('2', 'c')];

describe('Blackjack hand totals', () => {
    it('counts aces as 11 or 1 for the best total', () => {
        assert.equal(handTotal([c('A'), c('K')]), 21);
        assert.equal(handTotal([c('A'), c('A'), c('9')]), 21);
        assert.equal(handTotal([c('A'), c('9'), c('5')]), 15);
        assert.equal(handTotal([c('A'), c('A')]), 12);
        assert.equal(handTotal([c('K'), c('Q'), c('5')]), 25);
        assert.equal(handTotal([c('J'), c('Q')]), 20);
    });

    it('builds a full shuffled 52-card deck', () => {
        const deck = freshDeck(Math.random);
        assert.equal(deck.length, 52);
        assert.equal(new Set(deck.map(x => x.rank + x.suit)).size, 52);
    });
});

describe('Blackjack dealing and hidden information', () => {
    it('deals two cards each and hides the dealer hole card from both players', () => {
        const game = gameWithDecks([ROUND_P1_WINS]);
        assert.deepEqual(game.hands[0], [c('10'), c('7')]);
        assert.deepEqual(game.hands[1], [c('10', 'h'), c('6', 'h')]);
        for (const p of [0, 1]) {
            const s = game.getStateForPlayer(p);
            assert.equal(s.phase, 'playing');
            assert.deepEqual(s.dealer.visible, [c('10', 'd')]);
            assert.equal(s.dealer.hiddenCount, 1);
            assert.equal(s.dealer.total, null);
            assert.equal(JSON.stringify(s).includes('"6","suit":"♦"'), false, 'hole card leaked');
            assert.deepEqual(s.totals, [17, 16]);
            assert.deepEqual(s.hands[0], [c('10'), c('7')]);
            assert.deepEqual(s.hands[1], [c('10', 'h'), c('6', 'h')]);
            assert.equal(s.round, 1);
            assert.deepEqual(s.roundWins, [0, 0]);
            assert.equal(s.winsNeeded, 3);
        }
        game.cleanup();
    });

    it('uses a fresh random deck each round by default', () => {
        const game = new Blackjack('r', sockets(), 0);
        assert.equal(game.deck.length, 46);
        const seen = new Set([...game.hands[0], ...game.hands[1], ...game.dealer, ...game.deck].map(x => x.rank + x.suit));
        assert.equal(seen.size, 52);
        game.cleanup();
    });
});

describe('Blackjack turn order and actions', () => {
    it('starting player acts first, then the other, then the dealer', () => {
        const game = gameWithDecks([ROUND_P1_WINS]);
        assert.equal(game.activePlayerIndex, 0);
        const notYours = game.makeMove(1, { action: 'hit' });
        assert.equal(notYours.valid, false);
        assert.match(notYours.message, /not your turn/i);

        assert.equal(game.makeMove(0, { action: 'stand' }).valid, true);
        assert.equal(game.activePlayerIndex, 1);
        assert.equal(game.makeMove(0, { action: 'hit' }).valid, false);

        assert.equal(game.makeMove(1, { action: 'hit' }).valid, true);
        assert.deepEqual(game.hands[1], [c('10', 'h'), c('6', 'h'), c('2', 'c')]);
        assert.equal(game.activePlayerIndex, 1, 'still player 1 after a non-busting hit');
        assert.equal(game.makeMove(1, { action: 'stand' }).valid, true);

        // dealer 16 -> draws 4 -> 20, stands
        assert.deepEqual(game.dealer, [c('10', 'd'), c('6', 'd'), c('4', 'c')]);
        assert.equal(game.phase, 'roundOver');
        const s = game.getStateForPlayer(0);
        assert.equal(s.activePlayerIndex, null);
        assert.equal(s.dealer.hiddenCount, 0);
        assert.equal(s.dealer.total, 20);
        assert.deepEqual(s.lastRoundResult.outcomes, ['lose', 'lose']);
        assert.equal(s.lastRoundResult.winner, 1, 'same outcome: higher total wins the round');
        assert.deepEqual(s.roundWins, [0, 1]);
        game.cleanup();
    });

    it('honors startingPlayerIndex = 1', () => {
        const game = gameWithDecks([ROUND_P1_WINS], 1);
        assert.equal(game.activePlayerIndex, 1);
        assert.equal(game.makeMove(0, { action: 'stand' }).valid, false);
        game.cleanup();
    });

    it('a bust ends the turn and loses even against a dealer bust', () => {
        // p0 10+7 hits K -> 27 bust; p1 10+6 stands; dealer 10+6 draws K -> 26 bust: p1 wins
        const deck = [c('10'), c('7'), c('10', 'h'), c('6', 'h'), c('10', 'd'), c('6', 'd'), c('K', 'c'), c('K', 'h')];
        const game = gameWithDecks([deck]);
        assert.equal(game.makeMove(0, { action: 'hit' }).valid, true);
        assert.equal(handTotal(game.hands[0]), 27);
        assert.equal(game.activePlayerIndex, 1);
        game.makeMove(1, { action: 'stand' });
        assert.equal(game.lastRoundResult.dealerTotal, 26);
        assert.deepEqual(game.lastRoundResult.outcomes, ['bust', 'win']);
        assert.equal(game.lastRoundResult.winner, 1);
        game.cleanup();
    });

    it('the dealer does not draw when both players bust, and the round is a tie', () => {
        const deck = [c('10'), c('7'), c('10', 'h'), c('6', 'h'), c('10', 'd'), c('6', 'd'), c('K', 'c'), c('K', 'h'), c('5', 'c')];
        const game = gameWithDecks([deck]);
        game.makeMove(0, { action: 'hit' });
        game.makeMove(1, { action: 'hit' });
        assert.equal(game.phase, 'roundOver');
        assert.equal(game.dealer.length, 2);
        assert.equal(game.lastRoundResult.winner, 'tie');
        assert.deepEqual(game.roundWins, [0, 0]);
        game.cleanup();
    });

    it('a hand reaching 21 stops automatically; a natural blackjack skips the decision', () => {
        // p0 A+K natural -> auto done; p1 acts immediately.
        const deck = [c('A'), c('K'), c('5', 'h'), c('6', 'h'), c('9', 'd'), c('8', 'd'), c('10', 'c')];
        const game = gameWithDecks([deck]);
        assert.equal(game.activePlayerIndex, 1);
        assert.equal(game.makeMove(0, { action: 'hit' }).valid, false);
        game.makeMove(1, { action: 'hit' }); // 5+6+10 = 21 -> auto stand
        assert.equal(game.phase, 'roundOver');
        assert.deepEqual(game.lastRoundResult.totals, [21, 21]);
        assert.equal(game.lastRoundResult.dealerTotal, 17);
        assert.deepEqual(game.lastRoundResult.outcomes, ['win', 'win']);
        assert.equal(game.lastRoundResult.winner, 0, 'blackjack beats a three-card 21');
        game.cleanup();
    });

    it('dealer stands on soft 17', () => {
        // dealer A+6 = soft 17: must not draw. p0 18 stands, p1 19 stands.
        const deck = [c('10'), c('8'), c('10', 'h'), c('9', 'h'), c('A', 'd'), c('6', 'd'), c('5', 'c')];
        const game = gameWithDecks([deck]);
        game.makeMove(0, { action: 'stand' });
        game.makeMove(1, { action: 'stand' });
        assert.equal(game.dealer.length, 2);
        assert.equal(game.lastRoundResult.dealerTotal, 17);
        assert.deepEqual(game.lastRoundResult.outcomes, ['win', 'win']);
        assert.equal(game.lastRoundResult.winner, 1);
        game.cleanup();
    });

    it('push beats lose, win beats push, and equal outcomes with equal totals tie', () => {
        // p0 18 push, p1 17 lose, dealer 18
        const deck1 = [c('10'), c('8'), c('10', 'h'), c('7', 'h'), c('10', 'd'), c('8', 'd')];
        const g1 = gameWithDecks([deck1]);
        g1.makeMove(0, { action: 'stand' });
        g1.makeMove(1, { action: 'stand' });
        assert.deepEqual(g1.lastRoundResult.outcomes, ['push', 'lose']);
        assert.equal(g1.lastRoundResult.winner, 0);
        g1.cleanup();

        // p0 18 push, p1 20 win
        const deck2 = [c('10'), c('8'), c('10', 'h'), c('Q', 'h'), c('10', 'd'), c('8', 'd')];
        const g2 = gameWithDecks([deck2]);
        g2.makeMove(0, { action: 'stand' });
        g2.makeMove(1, { action: 'stand' });
        assert.deepEqual(g2.lastRoundResult.outcomes, ['push', 'win']);
        assert.equal(g2.lastRoundResult.winner, 1);
        g2.cleanup();

        // both 20 vs dealer 18: both win, equal totals -> tie
        const deck3 = [c('10'), c('Q'), c('10', 'h'), c('K', 'h'), c('10', 'd'), c('8', 'd')];
        const g3 = gameWithDecks([deck3]);
        g3.makeMove(0, { action: 'stand' });
        g3.makeMove(1, { action: 'stand' });
        assert.equal(g3.lastRoundResult.winner, 'tie');
        assert.deepEqual(g3.roundWins, [0, 0]);
        g3.cleanup();
    });
});

describe('Blackjack match flow', () => {
    it('deals the next round after 3 seconds and swaps who acts first', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const game = gameWithDecks([ROUND_P0_WINS, ROUND_P1_WINS]);
        game.makeMove(0, { action: 'stand' });
        game.makeMove(1, { action: 'stand' });
        assert.equal(game.phase, 'roundOver');
        assert.equal(game.lastRoundResult.winner, 0);
        assert.notEqual(game.roundTimeout, null);
        assert.equal(game.makeMove(0, { action: 'hit' }).valid, false, 'no moves during roundOver');

        t.mock.timers.tick(2999);
        assert.equal(game.round, 1);
        t.mock.timers.tick(1);
        assert.equal(game.round, 2);
        assert.equal(game.phase, 'playing');
        assert.equal(game.activePlayerIndex, 1, 'the player who did not act first now does');
        assert.equal(game.roundTimeout, null);
        assert.deepEqual(game.hands[0], [c('10'), c('7')], 'fresh deal');
        assert.equal(game.getStateForPlayer(0).dealer.hiddenCount, 1, 'hole card hidden again');
        assert.deepEqual(game.roundWins, [1, 0]);
        game.cleanup();
    });

    it('ends the game when a player wins three rounds and stops scheduling deals', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const game = gameWithDecks([ROUND_P0_WINS]);
        for (let r = 1; r <= 3; r++) {
            assert.equal(game.round, r);
            const first = game.activePlayerIndex;
            game.makeMove(first, { action: 'stand' });
            game.makeMove(1 - first, { action: 'stand' });
            if (r < 3) t.mock.timers.tick(3000);
        }
        assert.equal(game.isGameOver, true);
        assert.equal(game.winner, 0);
        assert.deepEqual(game.roundWins, [3, 0]);
        assert.equal(game.roundTimeout, null);
        assert.equal(game.getStateForPlayer(1).activePlayerIndex, null);
        assert.equal(game.makeMove(0, { action: 'hit' }).valid, false);
        t.mock.timers.tick(10000);
        assert.equal(game.round, 3, 'no new round after the match ends');
        game.cleanup();
    });

    it('cleanup() cancels the pending deal', (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const game = gameWithDecks([ROUND_P0_WINS]);
        game.makeMove(0, { action: 'stand' });
        game.makeMove(1, { action: 'stand' });
        game.cleanup();
        assert.equal(game.roundTimeout, null);
        t.mock.timers.tick(5000);
        assert.equal(game.round, 1);
    });
});

describe('Blackjack malformed moves', () => {
    it('rejects bad actions without throwing', () => {
        const game = gameWithDecks([ROUND_P0_WINS]);
        for (const move of [{}, null, undefined, { action: 'split' }, { action: 1 }, { action: 1.5 }, { action: ['hit'] }, { action: 'HIT' }]) {
            let result;
            assert.doesNotThrow(() => { result = game.makeMove(0, move); });
            assert.equal(result.valid, false, JSON.stringify(move));
        }
        assert.equal(game.hands[0].length, 2);
        assert.equal(game.activePlayerIndex, 0);
        game.cleanup();
    });
});
