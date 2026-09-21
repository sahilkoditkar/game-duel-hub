function initBlackjack(socket, container, roomId, playerIndex, initialState) {
    const oldStyle = document.getElementById('blackjack-styles');
    if (oldStyle) oldStyle.remove();

    const style = document.createElement('style');
    style.id = 'blackjack-styles';
    style.textContent = `
        .bj-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 460px;
            margin: 0 auto;
            user-select: none;
        }
        .bj-info { font-size: 0.85rem; color: #888; text-align: center; }
        .bj-rounds {
            display: flex;
            gap: 8px;
            align-items: center;
            font-weight: bold;
            font-size: 1.05rem;
        }
        .bj-rounds .me { color: var(--secondary-color); }
        .bj-rounds .opp { color: var(--primary-color); }
        .bj-rounds .round { color: #aaa; font-size: 0.9rem; font-weight: normal; margin-left: 8px; }
        .bj-seat {
            width: 100%;
            background: #222;
            border-radius: 12px;
            padding: 10px 12px;
            box-sizing: border-box;
            border: 2px solid transparent;
        }
        .bj-seat.active { border-color: var(--secondary-color); }
        .bj-seat.dealer { background: #1c2a1f; }
        .bj-seat-head {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: 0.85rem;
            color: #aaa;
            margin-bottom: 8px;
        }
        .bj-seat-head .name { font-weight: bold; color: #ddd; }
        .bj-seat.me .bj-seat-head .name { color: var(--secondary-color); }
        .bj-seat.opp .bj-seat-head .name { color: var(--primary-color); }
        .bj-total { font-weight: bold; color: #fff; }
        .bj-total.bust { color: #ef4444; }
        .bj-total.bj { color: #10b981; }
        .bj-cards {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            min-height: clamp(54px, 15vw, 70px);
        }
        .bj-card {
            width: clamp(38px, 11vw, 50px);
            height: clamp(54px, 15vw, 70px);
            border-radius: 6px;
            background: #f5f5f5;
            color: #111;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 4px 5px;
            box-sizing: border-box;
            font-weight: bold;
            font-size: clamp(0.8rem, 3vw, 1rem);
            line-height: 1;
            box-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }
        .bj-card.red { color: #c0262d; }
        .bj-card .suit { align-self: flex-end; font-size: 1.15em; }
        .bj-card.back {
            background: repeating-linear-gradient(45deg, #3b3b8f 0 6px, #2a2a6a 6px 12px);
            border: 2px solid #ddd;
        }
        .bj-actions {
            display: flex;
            gap: 10px;
            width: 100%;
        }
        .bj-btn {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            touch-action: manipulation;
            transition: transform 0.1s;
        }
        .bj-btn:active:not(:disabled) { transform: scale(0.97); }
        .bj-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .bj-btn.hit { background: var(--primary-color); color: #000; }
        .bj-btn.stand { background: var(--secondary-color); color: #000; }
        .bj-banner {
            width: 100%;
            min-height: 1.5em;
            text-align: center;
            font-weight: bold;
            color: #ddd;
            font-size: 1rem;
        }
        .bj-banner.win { color: #10b981; }
        .bj-banner.lose { color: #ef4444; }
        .bj-sub { color: #aaa; font-size: 0.85rem; text-align: center; min-height: 1.2em; }
    `;
    document.head.appendChild(style);

    container.innerHTML = `
        <h3 id="game-status">Blackjack</h3>
        <div class="bj-wrap">
            <div class="bj-info">Beat the dealer, then beat your rival. Bust = lose. First to 3 round wins takes it.</div>
            <div class="bj-rounds">
                <span class="me">You <span id="bj-me">0</span></span><span>-</span><span class="opp"><span id="bj-opp">0</span> Opp</span>
                <span class="round" id="bj-round">Round 1</span>
            </div>
            <div class="bj-seat dealer" id="bj-dealer-seat">
                <div class="bj-seat-head"><span class="name">Dealer</span><span class="bj-total" id="bj-dealer-total"></span></div>
                <div class="bj-cards" id="bj-dealer-cards"></div>
            </div>
            <div class="bj-seat opp" id="bj-opp-seat">
                <div class="bj-seat-head"><span class="name">Opponent</span><span class="bj-total" id="bj-opp-total"></span></div>
                <div class="bj-cards" id="bj-opp-cards"></div>
            </div>
            <div class="bj-seat me" id="bj-me-seat">
                <div class="bj-seat-head"><span class="name">You</span><span class="bj-total" id="bj-me-total"></span></div>
                <div class="bj-cards" id="bj-me-cards"></div>
            </div>
            <div class="bj-actions">
                <button class="bj-btn hit" id="bj-hit" disabled>Hit</button>
                <button class="bj-btn stand" id="bj-stand" disabled>Stand</button>
            </div>
            <div class="bj-banner" id="bj-banner"></div>
            <div class="bj-sub" id="bj-sub"></div>
        </div>
    `;

    const statusEl = document.getElementById('game-status');
    const meWinsEl = document.getElementById('bj-me');
    const oppWinsEl = document.getElementById('bj-opp');
    const roundEl = document.getElementById('bj-round');
    const dealerSeat = document.getElementById('bj-dealer-seat');
    const oppSeat = document.getElementById('bj-opp-seat');
    const meSeat = document.getElementById('bj-me-seat');
    const dealerCards = document.getElementById('bj-dealer-cards');
    const oppCards = document.getElementById('bj-opp-cards');
    const meCards = document.getElementById('bj-me-cards');
    const dealerTotal = document.getElementById('bj-dealer-total');
    const oppTotal = document.getElementById('bj-opp-total');
    const meTotal = document.getElementById('bj-me-total');
    const hitBtn = document.getElementById('bj-hit');
    const standBtn = document.getElementById('bj-stand');
    const bannerEl = document.getElementById('bj-banner');
    const subEl = document.getElementById('bj-sub');
    const myIdx = playerIndex;
    let lastState = initialState || null;

    function act(action) {
        if (!canAct(lastState, myIdx)) return;
        if (!lastState || lastState.phase !== 'playing') return;
        socket.emit('make_move', { roomId, move: { action } });
    }
    hitBtn.addEventListener('click', () => act('hit'));
    standBtn.addEventListener('click', () => act('stand'));

    socket.off('game_state');
    socket.off('invalid_move');
    socket.on('game_state', (s) => render(s));
    socket.on('invalid_move', (msg) => {
        if (typeof showToast === 'function') showToast(msg);
        else alert(msg);
    });

    if (initialState) render(initialState);

    function cardEl(card) {
        const el = document.createElement('div');
        el.className = 'bj-card';
        if (card.suit === '♥' || card.suit === '♦') el.classList.add('red');
        const rank = document.createElement('span');
        rank.textContent = card.rank;
        const suit = document.createElement('span');
        suit.className = 'suit';
        suit.textContent = card.suit;
        el.appendChild(rank);
        el.appendChild(suit);
        return el;
    }

    function backEl() {
        const el = document.createElement('div');
        el.className = 'bj-card back';
        return el;
    }

    function fillCards(target, cards, hidden) {
        target.innerHTML = '';
        cards.forEach(c => target.appendChild(cardEl(c)));
        for (let i = 0; i < hidden; i++) target.appendChild(backEl());
    }

    function totalLabel(el, total, cards) {
        el.className = 'bj-total';
        if (total > 21) { el.textContent = 'Bust ' + total; el.classList.add('bust'); }
        else if (total === 21 && cards.length === 2) { el.textContent = 'Blackjack!'; el.classList.add('bj'); }
        else el.textContent = total;
    }

    function render(state) {
        lastState = state;
        const { hands, dealer, totals, phase, round, roundWins, winsNeeded, lastRoundResult,
            activePlayerIndex, isGameOver, winner } = state;
        const oppIdx = 1 - myIdx;

        meWinsEl.textContent = roundWins[myIdx];
        oppWinsEl.textContent = roundWins[oppIdx];
        roundEl.textContent = isGameOver ? 'Match over' : `Round ${round} · first to ${winsNeeded}`;

        fillCards(dealerCards, dealer.visible, dealer.hiddenCount);
        fillCards(oppCards, hands[oppIdx], 0);
        fillCards(meCards, hands[myIdx], 0);

        if (dealer.total !== null && dealer.total !== undefined) totalLabel(dealerTotal, dealer.total, dealer.visible);
        else { dealerTotal.className = 'bj-total'; dealerTotal.textContent = '?'; }
        totalLabel(oppTotal, totals[oppIdx], hands[oppIdx]);
        totalLabel(meTotal, totals[myIdx], hands[myIdx]);

        const myTurn = phase === 'playing' && activePlayerIndex === myIdx && !isGameOver;
        meSeat.classList.toggle('active', myTurn);
        oppSeat.classList.toggle('active', phase === 'playing' && activePlayerIndex === oppIdx && !isGameOver);
        dealerSeat.classList.toggle('active', phase === 'dealer');
        hitBtn.disabled = !myTurn;
        standBtn.disabled = !myTurn;

        // Round result banner
        bannerEl.className = 'bj-banner';
        if ((phase === 'roundOver' || isGameOver) && lastRoundResult) {
            const r = lastRoundResult;
            const outcomeWord = { win: 'beat the dealer', push: 'pushed', lose: 'lost to the dealer', bust: 'busted' };
            let headline;
            if (r.winner === myIdx) { headline = 'You won the round!'; bannerEl.classList.add('win'); }
            else if (r.winner === oppIdx) { headline = 'Opponent won the round'; bannerEl.classList.add('lose'); }
            else headline = 'Round tied';
            bannerEl.textContent = headline;
            subEl.textContent = `You ${outcomeWord[r.outcomes[myIdx]]} (${r.totals[myIdx]}) · Opp ${outcomeWord[r.outcomes[oppIdx]]} (${r.totals[oppIdx]}) · Dealer ${r.dealerTotal}`
                + (isGameOver ? '' : ' · next round soon...');
        } else if (phase === 'dealer') {
            bannerEl.textContent = 'Dealer is drawing...';
            subEl.textContent = '';
        } else {
            bannerEl.textContent = '';
            subEl.textContent = myTurn ? 'Hit for another card or stand on your total.' : '';
        }

        if (isGameOver) {
            const msg = winner === 'draw' ? "It's a Draw!" : (winner === myIdx ? 'You Won!' : 'You Lost!');
            statusEl.textContent = msg;
            showStatus(msg);
        } else if (phase !== 'playing') {
            statusEl.textContent = phase === 'dealer' ? 'Dealer\'s turn' : 'Round over';
        } else {
            statusEl.textContent = myTurn ? 'Your Turn' : "Opponent's Turn";
        }
    }
}
