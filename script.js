document.addEventListener('DOMContentLoaded', () => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suitSymbols = {
        hearts: '&hearts;',
        diamonds: '&diams;',
        clubs: '&clubs;',
        spades: '&spades;'
    };

    const cardDeck = document.getElementById('card-deck');
    const printBtn = document.getElementById('print-btn');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const themeInput = document.getElementById('theme-input');
    const loader = document.getElementById('loader');

    function generateDeck() {
        cardDeck.innerHTML = ''; // Clear existing cards

        for (const suit of suits) {
            for (const rank of ranks) {
                const card = createCardElement(suit, rank);
                cardDeck.appendChild(card);
            }
        }
    }

    function createCardElement(suit, rank) {
        const card = document.createElement('div');
        const color = (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black';
        card.className = `card color-${color}`;
        card.dataset.suit = suit;
        card.dataset.rank = rank;

        const suitSymbol = suitSymbols[suit];
        const isFaceCard = ['J', 'Q', 'K'].includes(rank);

        card.innerHTML = `
            <div class="corner top-left">
                <div class="rank">${rank}</div>
                <div class="suit">${suitSymbol}</div>
            </div>
            <div class="center-suit">${isFaceCard ? rank : suitSymbol}</div>
            <div class="corner bottom-right">
                <div class="rank">${rank}</div>
                <div class="suit">${suitSymbol}</div>
            </div>
        `;

        return card;
    }

    async function applyTheme() {
        const theme = themeInput.value.trim();
        if (!theme) {
            alert('Please enter a theme.');
            return;
        }

        const cards = Array.from(document.querySelectorAll('.card'));
        loader.classList.remove('hidden');
        generateBtn.disabled = true;
        resetBtn.disabled = true;
        printBtn.disabled = true;

        const batchSize = 5; // Process images in smaller batches

        try {
            for (let i = 0; i < cards.length; i += batchSize) {
                const batch = cards.slice(i, i + batchSize);
                const imagePromises = batch.map(card => {
                    const rank = card.dataset.rank;
                    const suit = card.dataset.suit;
                    const rankName = { 'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack' }[rank] || rank;

                    const prompt = `Simple, centered icon representing the ${rankName} of ${suit}, with a "${theme}" theme. Clean lines, vector style icon.`;

                    return websim.imageGen({
                        prompt: prompt,
                        transparent: true,
                    }).then(result => ({ card, url: result.url }));
                });

                const batchResults = await Promise.all(imagePromises);

                batchResults.forEach(({ card, url }) => {
                    const centerSuit = card.querySelector('.center-suit');
                    if (centerSuit) {
                        centerSuit.innerHTML = `<img src="${url}" alt="Themed card art for ${card.dataset.rank} of ${card.dataset.suit}">`;
                    }
                });
            }
        } catch (error) {
            console.error("Error generating images:", error);
            const errorMessage = `Sorry, there was an error generating the card art. Please try again.\n\nError details:\n${error.message}`;
            alert(errorMessage);
        } finally {
            loader.classList.add('hidden');
            generateBtn.disabled = false;
            resetBtn.disabled = false;
            printBtn.disabled = false;
        }
    }

    printBtn.addEventListener('click', () => {
        window.print();
    });

    generateBtn.addEventListener('click', applyTheme);
    resetBtn.addEventListener('click', generateDeck);

    // Initial deck generation
    generateDeck();
});