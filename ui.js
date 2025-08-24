import { suits, ranks, suitSymbols } from './constants.js';

function createCardElement(suit, rank) {
    const card = document.createElement('div');
    const color = (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';
    card.className = `card color-${color}`;
    card.dataset.suit = suit;
    card.dataset.rank = rank;

    const suitSymbol = suitSymbols[suit];
    
    card.innerHTML = `
        <div class="corner top-left">
            <div class="rank">${rank}</div>
            <div class="suit">${suitSymbol}</div>
        </div>
        <div class="center-suit">${suitSymbol}</div>
        <div class="corner bottom-right">
            <div class="rank">${rank}</div>
            <div class="suit">${suitSymbol}</div>
        </div>
    `;

    return card;
}

export function generateDeck(cardDeckElement) {
    cardDeckElement.innerHTML = ''; // Clear existing cards

    for (const suit of suits) {
        for (const rank of ranks) {
            const card = createCardElement(suit, rank);
            cardDeckElement.appendChild(card);
        }
    }
}