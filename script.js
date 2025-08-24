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

    // Utility functions for error handling and retries
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
                    console.log(`Waiting ${delay}ms before retry...`);
                    await sleep(delay);
                } else {
                    console.error(`All ${maxRetries} attempts failed. Last error:`, error);
                }
            }
        }
        
        throw lastError;
    }

    async function safeImageGeneration(prompt, retries = 3) {
        return await withRetry(async () => {
            try {
                const result = await websim.imageGen({
                    prompt: prompt,
                    transparent: true,
                });
                
                if (!result || !result.url) {
                    throw new Error('Invalid image generation result');
                }
                
                return result;
            } catch (error) {
                throw new Error(`Image generation failed: ${error.message}`);
            }
        }, retries, 2000);
    }

    async function safeFileUpload(file, retries = 3) {
        return await withRetry(async () => {
            try {
                if (!file || file.size === 0) {
                    throw new Error('Invalid file for upload');
                }
                
                const uploadedUrl = await websim.upload(file);
                
                if (!uploadedUrl) {
                    throw new Error('Upload returned empty URL');
                }
                
                return uploadedUrl;
            } catch (error) {
                throw new Error(`File upload failed: ${error.message}`);
            }
        }, retries, 1500);
    }

    async function safeChatCompletion(messages, retries = 3) {
        return await withRetry(async () => {
            try {
                const completion = await websim.chat.completions.create({
                    messages: messages,
                });
                
                if (!completion || !completion.content) {
                    throw new Error('Invalid chat completion result');
                }
                
                return completion;
            } catch (error) {
                throw new Error(`Chat completion failed: ${error.message}`);
            }
        }, retries, 2500);
    }

    async function safeImageFetch(url, retries = 3) {
        return await withRetry(async () => {
            try {
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const blob = await response.blob();
                
                if (blob.size === 0) {
                    throw new Error('Downloaded image is empty');
                }
                
                return blob;
            } catch (error) {
                throw new Error(`Image fetch failed: ${error.message}`);
            }
        }, retries, 1000);
    }

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
        let successfulCards = 0;
        let failedCards = 0;

        try {
            // 1. Find and generate the Ace of Hearts first to establish a style
            const aceOfHeartsCard = cards.find(c => c.dataset.suit === 'hearts' && c.dataset.rank === 'A');
            if (!aceOfHeartsCard) {
                throw new Error("Could not find the Ace of Hearts card to start theme generation.");
            }

            progressText.textContent = 'Generating style leader (Ace of Hearts)...';
            console.log('Starting theme generation with:', theme);
            
            const aceRankName = 'Ace';
            const aceSuit = 'hearts';
            const initialPrompt = `Simple, centered icon representing the ${aceRankName} of ${aceSuit}, with a "${theme}" theme. Clean lines, vector style icon, no text.`;
            
            // Generate initial image with retry logic
            const imageResult = await safeImageGeneration(initialPrompt);
            const imageUrl = imageResult.url;
            console.log('Generated Ace of Hearts image:', imageUrl);

            let centerSuit = aceOfHeartsCard.querySelector('.center-suit');
            if (centerSuit) {
                centerSuit.innerHTML = `<img src="${imageUrl}" alt="Themed card art for Ace of Hearts">`;
                successfulCards++;
            }

            // 2. Upload the generated image to database for AI analysis
            progressText.textContent = 'Uploading image for analysis...';
            
            // Fetch the generated image and convert to blob with error handling
            const imageBlob = await safeImageFetch(imageUrl);
            console.log('Downloaded image blob, size:', imageBlob.size);
            
            // Create a file from the blob
            const timestamp = Date.now();
            const imageFile = new File([imageBlob], `ace_of_hearts_${timestamp}.png`, { type: 'image/png' });
            
            // Upload to database with retry logic
            const uploadedUrl = await safeFileUpload(imageFile);
            console.log('Uploaded image to:', uploadedUrl);

            // Add delay before AI analysis
            await sleep(1000);

            // 3. Get a detailed description of the generated image using the uploaded URL
            progressText.textContent = 'Analyzing art style...';
            
            const messages = [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Describe the art style of this image in a way that can be used to generate other similar images. Focus on style, texture, and color palette, not the subject matter (ace of hearts). Keep it concise but detailed.' },
                    { type: 'image_url', image_url: { url: uploadedUrl } },
                ],
            }];

            const descriptionCompletion = await safeChatCompletion(messages);
            styleDescription = descriptionCompletion.content;
            console.log('Generated style description:', styleDescription);

            // Add delay before starting batch generation
            await sleep(1500);

            // 4. Generate the rest of the cards one by one using the style description
            const otherCards = cards.filter(c => !(c.dataset.suit === 'hearts' && c.dataset.rank === 'A'));
            
            for (let i = 0; i < otherCards.length; i++) {
                const card = otherCards[i];
                const cardNumber = i + 2;
                progressText.textContent = `Generating card ${cardNumber} of 52... (${successfulCards} successful, ${failedCards} failed)`;

                const rank = card.dataset.rank;
                const suit = card.dataset.suit;
                const rankName = { 'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack' }[rank] || rank;
                
                const subsequentPrompt = `A centered icon of the ${rankName} of ${suit}. The art must follow this style guide: "${styleDescription}"`;

                try {
                    // Add delay between requests to avoid rate limiting
                    if (i > 0) {
                        await sleep(800); // Staggered delay
                    }

                    const result = await safeImageGeneration(subsequentPrompt);
                    console.log(`Generated ${rankName} of ${suit}:`, result.url);

                    centerSuit = card.querySelector('.center-suit');
                    if (centerSuit) {
                        centerSuit.innerHTML = `<img src="${result.url}" alt="Themed card art for ${rank} of ${suit}">`;
                        successfulCards++;
                    }
                } catch (cardError) {
                    console.error(`Error generating image for ${rankName} of ${suit}:`, cardError);
                    failedCards++;
                    
                    // Add a more informative placeholder on error
                    centerSuit = card.querySelector('.center-suit');
                    if (centerSuit) {
                        centerSuit.innerHTML = `<span title="Generation failed: ${cardError.message}">⚠️</span>`;
                    }
                }
            }
            
            const finalMessage = `Generation Complete! ${successfulCards} successful, ${failedCards} failed.`;
            progressText.textContent = finalMessage;
            console.log(finalMessage);

            if (failedCards > 0) {
                alert(`Theme generation completed with some issues.\n${successfulCards} cards generated successfully.\n${failedCards} cards failed to generate.\n\nCheck console for detailed error information.`);
            }

        } catch (error) {
            console.error("Critical error during theme generation:", error);
            const errorMessage = `Sorry, there was a critical error generating the card art. Please try again.\n\nError details:\n${error.message}\n\nTechnical info: Check browser console for full details.`;
            alert(errorMessage);
            progressText.textContent = `Critical error: ${error.message}`;
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