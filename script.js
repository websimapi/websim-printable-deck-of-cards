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
    const progressText = document.getElementById('progress-text');

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
        progressText.textContent = '';
        generateBtn.disabled = true;
        resetBtn.disabled = true;
        printBtn.disabled = true;

        let styleDescription = '';

        try {
            // 1. Find and generate the Ace of Hearts first to establish a style
            const aceOfHeartsCard = cards.find(c => c.dataset.suit === 'hearts' && c.dataset.rank === 'A');
            if (!aceOfHeartsCard) {
                throw new Error("Could not find the Ace of Hearts card to start theme generation.");
            }

            progressText.textContent = 'Generating style leader (Ace of Hearts)...';
            const aceRankName = 'Ace';
            const aceSuit = 'hearts';
            const initialPrompt = `Simple, centered icon representing the ${aceRankName} of ${aceSuit}, with a "${theme}" theme. Clean lines, vector style icon, no text.`;
            
            const imageResult = await websim.imageGen({
                prompt: initialPrompt,
                transparent: true,
            });
            const imageUrl = imageResult.url;

            let centerSuit = aceOfHeartsCard.querySelector('.center-suit');
            if (centerSuit) {
                centerSuit.innerHTML = `<img src="${imageUrl}" alt="Themed card art for Ace of Hearts">`;
            }

            // 2. Upload the generated image to database for AI analysis
            progressText.textContent = 'Uploading image for analysis...';
            
            // Fetch the generated image and convert to blob
            const imageResponse = await fetch(imageUrl);
            const imageBlob = await imageResponse.blob();
            
            // Create a file from the blob
            const imageFile = new File([imageBlob], 'ace_of_hearts.png', { type: 'image/png' });
            
            // Upload to database
            const uploadedUrl = await websim.upload(imageFile);

            // 2. Get a detailed description of the generated image using the uploaded URL
            progressText.textContent = 'Analyzing art style...';
            const descriptionCompletion = await websim.chat.completions.create({
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Describe the art style of this image in a way that can be used to generate other similar images. Focus on style, texture, and color palette, not the subject matter (ace of hearts).' },
                        { type: 'image_url', image_url: { url: uploadedUrl } },
                    ],
                }],
            });
            styleDescription = descriptionCompletion.content;

            // 3. Generate the rest of the cards one by one using the style description
            const otherCards = cards.filter(c => !(c.dataset.suit === 'hearts' && c.dataset.rank === 'A'));
            
            for (let i = 0; i < otherCards.length; i++) {
                const card = otherCards[i];
                progressText.textContent = `Generating card ${i + 2} of 52...`;

                const rank = card.dataset.rank;
                const suit = card.dataset.suit;
                const rankName = { 'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack' }[rank] || rank;
                
                const subsequentPrompt = `A centered icon of the ${rankName} of ${suit}. The art must follow this style guide: "${styleDescription}"`;

                try {
                    const result = await websim.imageGen({
                        prompt: subsequentPrompt,
                        transparent: true,
                    });

                    centerSuit = card.querySelector('.center-suit');
                    if (centerSuit) {
                        centerSuit.innerHTML = `<img src="${result.url}" alt="Themed card art for ${rank} of ${suit}">`;
                    }
                } catch (cardError) {
                    console.error(`Error generating image for ${rankName} of ${suit}:`, cardError);
                    // Add a placeholder or leave the default symbol on error
                     centerSuit = card.querySelector('.center-suit');
                     if (centerSuit) {
                        centerSuit.textContent = '⚠️';
                     }
                }
            }
             progressText.textContent = 'Generation Complete!';

        } catch (error) {
            console.error("Error generating themed deck:", error);
            const errorMessage = `Sorry, there was an error generating the card art. Please try again.\n\nError details:\n${error.message}`;
            alert(errorMessage);
            progressText.textContent = 'An error occurred.';
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