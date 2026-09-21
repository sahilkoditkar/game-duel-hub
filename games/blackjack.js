const BaseGame = require('./base-game');

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣']; // ♠ ♥ ♦ ♣
const WINS_NEEDED = 3;
const ROUND_OVER_MS = 3000;
const OUTCOME_RANK = { win: 2, push: 1, lose: 0 };

function cardValue(rank) {
    if (rank === 'A') return 11;
    if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
    return parseInt(rank, 10);
}

// Best total: aces count 11 unless that busts, then 1 each as needed.
function handTotal(cards) {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
        total += cardValue(c.rank);
        if (c.rank === 'A') aces++;
    }
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}

function isBlackjack(cards) {
    return cards.length === 2 && handTotal(cards) === 21;
}

// Comparable strength: bust counts as nothing, a natural beats any other 21.
function handStrength(cards) {
    const total = handTotal(cards);
    if (total > 21) return 0;
    if (isBlackjack(cards)) return 21.5;
    return total;
}

function freshDeck(rng) {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) deck.push({ rank, suit });
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

class Blackjack extends BaseGame {
    // options (optional, tests only): { deckFactory: (round) => [cards, top first], rng: () => [0,1) }
    constructor(id, players, startingPlayerIndex, options) {
        super(id, players, startingPlayerIndex);
        const opts = options && typeof options === 'object' ? options : {};
        this.rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
        this.deckFactory = typeof opts.deckFactory === 'function'
            ? opts.deckFactory
            : () => freshDeck(this.rng);

        this.round = 1;
        this.roundWins = [0, 0];
        this.winsNeeded = WINS_NEEDED;
        this.firstActor = startingPlayerIndex === 1 ? 1 : 0;
        this.lastRoundResult = null;
        this.roundTimeout = null;
        this.roundOverMs = ROUND_OVER_MS;

        this.dealRound();
    }

    // ---- round flow ------------------------------------------------------

    dealRound() {
        this.deck = this.deckFactory(this.round).slice();
        this.hands = [[], []];
        this.dealer = [];
        this.done = [false, false];
        this.phase = 'playing'; // 'playing' | 'dealer' | 'roundOver'
        this.dealerRevealed = false;

        this.hands[0].push(this.draw(), this.draw());
        this.hands[1].push(this.draw(), this.draw());
        this.dealer.push(this.draw(), this.draw());

        this.activePlayerIndex = this.firstActor;
        // A natural 21 needs no decision.
        for (let i = 0; i < 2; i++) {
            if (handTotal(this.hands[i]) === 21) this.done[i] = true;
        }
        this.advanceTurn();
    }

    draw() {
        if (this.deck.length === 0) this.deck = freshDeck(this.rng);
        return this.deck.shift();
    }

    // Hand the turn to whoever still has to act; dealer plays once both are done.
    advanceTurn() {
        const order = [this.firstActor, 1 - this.firstActor];
        for (const p of order) {
            if (!this.done[p]) {
                this.activePlayerIndex = p;
                return;
            }
        }
        this.playDealer();
    }

    playDealer() {
        this.phase = 'dealer';
        this.activePlayerIndex = null;
        this.dealerRevealed = true;
        const anyoneStanding = this.hands.some(h => handTotal(h) <= 21);
        // Dealer draws to 17 or more and stands on soft 17 (nothing to beat if both busted).
        while (anyoneStanding && handTotal(this.dealer) < 17) {
            this.dealer.push(this.draw());
        }
        this.resolveRound();
    }

    resolveRound() {
        const dealerTotal = handTotal(this.dealer);
        const dealerStrength = handStrength(this.dealer);
        const outcomes = this.hands.map(hand => {
            const total = handTotal(hand);
            if (total > 21) return 'bust';
            const s = handStrength(hand);
            if (dealerTotal > 21 || s > dealerStrength) return 'win';
            if (s === dealerStrength) return 'push';
            return 'lose';
        });

        const rank = outcomes.map(o => (o === 'bust' ? OUTCOME_RANK.lose : OUTCOME_RANK[o]));
        let roundWinner = 'tie';
        if (rank[0] !== rank[1]) {
            roundWinner = rank[0] > rank[1] ? 0 : 1;
        } else {
            const s0 = handStrength(this.hands[0]);
            const s1 = handStrength(this.hands[1]);
            if (s0 !== s1) roundWinner = s0 > s1 ? 0 : 1;
        }

        if (roundWinner !== 'tie') this.roundWins[roundWinner]++;

        this.lastRoundResult = {
            round: this.round,
            outcomes,
            totals: this.hands.map(handTotal),
            dealerTotal,
            winner: roundWinner
        };
        this.phase = 'roundOver';
        this.activePlayerIndex = null;

        if (this.roundWins[0] >= this.winsNeeded) {
            this.isGameOver = true;
            this.winner = 0;
        } else if (this.roundWins[1] >= this.winsNeeded) {
            this.isGameOver = true;
            this.winner = 1;
        } else {
            this.clearRoundTimeout();
            this.roundTimeout = setTimeout(() => {
                this.roundTimeout = null;
                this.nextRound();
            }, this.roundOverMs);
        }
    }

    nextRound() {
        if (this.isGameOver || this.phase !== 'roundOver') return;
        this.round++;
        this.firstActor = 1 - this.firstActor;
        this.dealRound();
        this.emitState();
    }

    clearRoundTimeout() {
        if (this.roundTimeout) {
            clearTimeout(this.roundTimeout);
            this.roundTimeout = null;
        }
    }

    cleanup() {
        this.clearRoundTimeout();
    }

    // ---- moves -----------------------------------------------------------

    makeMove(playerIndex, moveData) {
        if (this.isGameOver) {
            return { valid: false, message: 'Game is over' };
        }
        if (this.phase !== 'playing') {
            return { valid: false, message: 'Wait for the next round' };
        }
        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: 'Not your turn' };
        }
        const action = moveData && typeof moveData.action === 'string' ? moveData.action : '';
        if (action !== 'hit' && action !== 'stand') {
            return { valid: false, message: 'Hit or stand' };
        }

        const hand = this.hands[playerIndex];
        if (action === 'hit') {
            hand.push(this.draw());
            if (handTotal(hand) >= 21) this.done[playerIndex] = true;
        } else {
            this.done[playerIndex] = true;
        }

        if (this.done[playerIndex]) this.advanceTurn();
        this.emitState();
        return { valid: true };
    }

    // ---- state -----------------------------------------------------------

    getState() {
        return this.getStateForPlayer(0);
    }

    getStateForPlayer(_playerIndex) {
        const dealer = this.dealerRevealed
            ? { visible: this.dealer.slice(), hiddenCount: 0, total: handTotal(this.dealer) }
            : { visible: this.dealer.slice(0, 1), hiddenCount: this.dealer.length - 1, total: null };
        return {
            hands: this.hands.map(h => h.slice()),
            dealer,
            totals: this.hands.map(handTotal),
            phase: this.phase,
            round: this.round,
            roundWins: this.roundWins.slice(),
            winsNeeded: this.winsNeeded,
            lastRoundResult: this.lastRoundResult,
            activePlayerIndex: this.phase === 'playing' ? this.activePlayerIndex : null,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = Blackjack;
module.exports.handTotal = handTotal;
module.exports.freshDeck = freshDeck;
