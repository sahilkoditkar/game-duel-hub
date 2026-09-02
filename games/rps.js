const BaseGame = require('./base-game');

const CHOICES = ['rock', 'paper', 'scissors'];

function beats(a, b) {
    return (
        (a === 'rock' && b === 'scissors') ||
        (a === 'paper' && b === 'rock') ||
        (a === 'scissors' && b === 'paper')
    );
}

class RockPaperScissors extends BaseGame {
    constructor(id, players, startingPlayerIndex) {
        super(id, players, startingPlayerIndex);
        this.choices = [null, null];
        this.round = 1;
        this.roundWins = [0, 0];
        this.winsNeeded = 2;
        this.lastRound = null;
        this.gameState = {
            round: this.round,
            roundWins: this.roundWins
        };
    }

    makeMove(playerIndex, moveData) {
        if (this.isGameOver) {
            return { valid: false, message: 'Game is over' };
        }

        const choice = moveData && typeof moveData.choice === 'string'
            ? moveData.choice.toLowerCase()
            : '';

        if (!CHOICES.includes(choice)) {
            return { valid: false, message: 'Pick rock, paper, or scissors' };
        }
        if (this.choices[playerIndex]) {
            return { valid: false, message: 'You already locked in this round' };
        }

        this.choices[playerIndex] = choice;

        if (this.choices[0] && this.choices[1]) {
            this.resolveRound();
        }

        this.emitState();
        return { valid: true };
    }

    resolveRound() {
        const [c0, c1] = this.choices;
        let winner = 'draw';
        if (beats(c0, c1)) winner = 0;
        else if (beats(c1, c0)) winner = 1;

        if (winner !== 'draw') {
            this.roundWins[winner]++;
        }

        this.lastRound = { choices: [c0, c1], winner, round: this.round };

        if (this.roundWins[0] >= this.winsNeeded) {
            this.isGameOver = true;
            this.winner = 0;
        } else if (this.roundWins[1] >= this.winsNeeded) {
            this.isGameOver = true;
            this.winner = 1;
        } else {
            this.round++;
            this.choices = [null, null];
        }

        this.gameState = {
            round: this.round,
            roundWins: this.roundWins
        };
    }

    getStateForPlayer(playerIndex) {
        const opponentReady = this.choices[1 - playerIndex] !== null;
        return {
            myChoice: this.choices[playerIndex],
            opponentReady,
            round: this.round,
            roundWins: this.roundWins,
            winsNeeded: this.winsNeeded,
            lastRound: this.lastRound,
            isGameOver: this.isGameOver,
            winner: this.winner,
            activePlayerIndex: null
        };
    }
}

module.exports = RockPaperScissors;
