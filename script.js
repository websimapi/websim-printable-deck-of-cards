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
    const scaleSlider = document.getElementById('scale-slider');
    const scaleControl = document.querySelector('.scale-control');

    // Utility functions for error handling and retries
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Function to copy error details to clipboard
    async function copyErrorToClipboard(errorDetails) {
        try {
            const errorText = `Error Report:\n\n${errorDetails}\n\nGenerated at: ${new Date().toISOString()}`;
            await navigator.clipboard.writeText(errorText);
            
            // Show a temporary notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #28a745;
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                z-index: 1000;
                font-family: inherit;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            `;
            notification.textContent = 'Error details copied to clipboard!';
            document.body.appendChild(notification);
            
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 3000);
        } catch (clipboardError) {
            console.error('Failed to copy to clipboard:', clipboardError);
            // Fallback: create a text area for manual copying
            createErrorTextArea(errorDetails);
        }
    }

    function createErrorTextArea(errorDetails) {
        const errorText = `Error Report:\n\n${errorDetails}\n\nGenerated at: ${new Date().toISOString()}`;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        `;
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 800px;
            width: 100%;
            max-height: 80vh;
            overflow: auto;
        `;
        
        const title = document.createElement('h3');
        title.textContent = 'Error Details (Copy this text)';
        title.style.marginTop = '0';
        
        const textarea = document.createElement('textarea');
        textarea.value = errorText;
        textarea.style.cssText = `
            width: 100%;
            height: 300px;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            resize: vertical;
        `;
        textarea.select();
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            margin-top: 10px;
            padding: 8px 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        closeBtn.onclick = () => document.body.removeChild(overlay);
        
        modal.appendChild(title);
        modal.appendChild(textarea);
        modal.appendChild(closeBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

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

    // --- Local Storage Functions ---
    function saveDeckToLocalStorage(deckData) {
        try {
            localStorage.setItem('savedDeck', JSON.stringify(deckData));
        } catch (e) {
            console.error("Failed to save deck to localStorage:", e);
        }
    }

    function loadDeckFromLocalStorage() {
        try {
            const savedDeckJSON = localStorage.getItem('savedDeck');
            if (savedDeckJSON) {
                return JSON.parse(savedDeckJSON);
            }
        } catch (e) {
            console.error("Failed to load deck from localStorage:", e);
            localStorage.removeItem('savedDeck'); // Clear corrupted data
        }
        return null;
    }

    function clearSavedDeck() {
        localStorage.removeItem('savedDeck');
        console.log("Saved deck cleared from localStorage.");
    }
    
    // --- Image Scale Functions ---
    function applyImageScale(scale) {
        document.documentElement.style.setProperty('--card-image-scale', scale);
    }

    function saveImageScale(scale) {
        localStorage.setItem('cardImageScale', scale);
    }

    function loadImageScale() {
        const savedScale = localStorage.getItem('cardImageScale');
        if (savedScale) {
            scaleSlider.value = savedScale;
            applyImageScale(savedScale);
        }
    }
    
    scaleSlider.addEventListener('input', (e) => {
        const newScale = e.target.value;
        applyImageScale(newScale);
        saveImageScale(newScale);
    });

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
        }, retries, 1000);
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
                console.log('Attempting chat completion with messages:', JSON.stringify(messages, null, 2));
                
                const completion = await websim.chat.completions.create({
                    model: "gpt-4o", // Explicitly use a multimodal model
                    messages: messages,
                });
                
                console.log('Chat completion successful, response:', completion);
                
                if (!completion || !completion.content) {
                    throw new Error('Invalid chat completion result - no content');
                }
                
                return completion;
            } catch (error) {
                console.error('Chat completion raw error:', error);
                console.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                });
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
        const savedDeck = loadDeckFromLocalStorage();
        let hasArt = false;
        
        if (savedDeck && savedDeck.theme) {
            themeInput.value = savedDeck.theme;
        }

        for (const suit of suits) {
            for (const rank of ranks) {
                const card = createCardElement(suit, rank);
                
                // Check for saved art
                if (savedDeck && savedDeck.cards) {
                    const cardData = savedDeck.cards[`${rank}-${suit}`];
                    if (cardData && cardData.imageUrl) {
                        const centerSuit = card.querySelector('.center-suit');
                        centerSuit.innerHTML = `<img src="${cardData.imageUrl}" alt="Themed art for ${rank} of ${suit}">`;
                        hasArt = true;
                    }
                }
                cardDeck.appendChild(card);
            }
        }
        
        if (hasArt) {
            scaleControl.classList.remove('hidden');
        } else {
            scaleControl.classList.add('hidden');
        }
    }

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
        const superPrompts = {}; // To store the base prompt for each rank
        let successfulCards = 0;
        let failedCards = 0;
        const generatedCardsData = {}; // To store results for localStorage

        try {
            // STAGE 1: Generate a single art style guide for the whole deck.
            progressText.textContent = 'Generating art style guide...';
            console.log('Generating art style for theme:', theme);
            
            const stylePrompt = `Create a concise but detailed art style guide for a deck of cards with the theme "${theme}". Describe the color palette, line style, and overall mood. The style should be suitable for simple, iconic card art. Example: "Minimalist vector art, thick outlines, limited color palette of dark blue, gold, and white, with a sophisticated and mystical mood."`;
            
            const descriptionCompletion = await safeChatCompletion([{ role: 'user', content: stylePrompt }]);
            styleDescription = descriptionCompletion.content;
            console.log('Generated style description:', styleDescription);

            // STAGE 2: Generate a "super prompt" concept for each rank.
            for (const rank of ranks) {
                 const rankName = { 'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack' }[rank] || `the number ${rank}`;
                 progressText.textContent = `Generating concept for ${rankName}...`;

                 const superPromptGenMessage = `
                    You are a creative assistant for generating playing card art.
                    The user's theme is: "${theme}".
                    The overall art style is: "${styleDescription}".

                    Your task is to create a detailed "super prompt" for the "${rankName}" card. This prompt will be used to generate an image.
                    - The prompt should describe a visual concept for the card that fits the theme and style.
                    - CRUCIALLY, the prompt must be suit-agnostic. It must include the placeholder "[SUIT_CONCEPT]" where a visual representation of the suit (e.g., "a glowing heart", "two magic wands in the shape of a diamond") should be incorporated.
                    - The prompt should NOT contain any text or letters to be rendered in the image.
                    - The final prompt should be a single, coherent paragraph focused on visual description.

                    Now, create the super prompt for the "${rankName}" card.
                `;

                const completion = await safeChatCompletion([{ role: 'user', content: superPromptGenMessage }]);
                superPrompts[rank] = completion.content;
                console.log(`Super prompt for ${rank}:`, superPrompts[rank]);
                await sleep(500); // Small delay between concept generations
            }

            // STAGE 3: Generate all 52 cards using the style guide and super prompts.
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                const cardNumber = i + 1;
                const rank = card.dataset.rank;
                const suit = card.dataset.suit;
                const rankName = { 'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack' }[rank] || rank;

                progressText.textContent = `Generating card ${cardNumber} of 52... (${successfulCards} successful, ${failedCards} failed)`;
                
                let finalPrompt = superPrompts[rank];
                
                // Create a suit-specific concept to insert into the super prompt
                const suitConcept = `a prominent, stylized ${suitSymbols[suit]} ${suit} symbol`;
                
                // Replace the placeholder with the actual suit concept
                finalPrompt = finalPrompt.replace(/\[SUIT_CONCEPT\]/g, suitConcept);
                // Reinforce the style guide
                finalPrompt += `. The image must strictly adhere to this art style: "${styleDescription}"`;

                try {
                    if (i > 0) await sleep(800);

                    const result = await safeImageGeneration(finalPrompt);
                    console.log(`Generated ${rankName} of ${suit}:`, result.url);
                    
                    // Store for saving
                    generatedCardsData[`${rank}-${suit}`] = { imageUrl: result.url };

                    let centerSuit = card.querySelector('.center-suit');
                    if (centerSuit) {
                        centerSuit.innerHTML = `<img src="${result.url}" alt="Themed art for ${rank} of ${suit}">`;
                        successfulCards++;
                    }
                } catch (cardError) {
                    console.error(`Error generating image for ${rankName} of ${suit}:`, cardError);
                    failedCards++;
                    
                    let centerSuit = card.querySelector('.center-suit');
                    if (centerSuit) {
                        centerSuit.innerHTML = `<span title="Generation failed: ${cardError.message}">⚠️</span>`;
                    }
                }
            }

            if (successfulCards > 0) {
                 const deckData = {
                    theme: theme,
                    style: styleDescription,
                    cards: generatedCardsData,
                };
                saveDeckToLocalStorage(deckData);
                scaleControl.classList.remove('hidden');
            }
            
            const finalMessage = `Generation Complete! ${successfulCards} successful, ${failedCards} failed.`;
            progressText.textContent = finalMessage;
            console.log(finalMessage);

            if (failedCards > 0) {
                // Show status info
                const statusDetails = [
                    `Theme Generation Complete`,
                    `Successful Cards: ${successfulCards}`,
                    `Failed Cards: ${failedCards}`,
                    `Theme: ${theme}`,
                    `Style Description: ${styleDescription}`,
                    `Browser: ${navigator.userAgent}`,
                    `Timestamp: ${new Date().toISOString()}`,
                    'Note: Some cards may have failed generation'
                ].join('\n');
                
                const color = failedCards > 0 ? '#856404' : '#28a745';
                const icon = failedCards > 0 ? '⚠️' : '✅';
                progressText.innerHTML = `<span style="color: ${color}; cursor: pointer; text-decoration: underline;" onclick="copyErrorToClipboard('${statusDetails.replace(/'/g, "\\'")}');">${icon} Click for details</span>`;
            }

        } catch (error) {
            console.error("Critical error during theme generation:", error);
            
            // Collect detailed error information
            const errorDetails = [
                `Critical Error: ${error.message}`,
                `Error Stack: ${error.stack || 'No stack trace available'}`,
                `Theme: ${theme}`,
                `Successful Cards: ${successfulCards}`,
                `Failed Cards: ${failedCards}`,
                `Style Description: ${styleDescription || 'Not generated yet'}`,
                `Browser: ${navigator.userAgent}`,
                `Timestamp: ${new Date().toISOString()}`,
                `Console Logs: Check browser console for additional WebSocket, network, or API errors`
            ].join('\n');
            
            progressText.textContent = `Critical error occurred. Click to copy details for support.`;
            progressText.style.cursor = 'pointer';
            progressText.style.textDecoration = 'underline';
            progressText.style.color = '#dc3545';
            progressText.onclick = () => copyErrorToClipboard(errorDetails);
            
            // Also copy automatically
            copyErrorToClipboard(errorDetails);
            
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
    
    resetBtn.addEventListener('click', () => {
        clearSavedDeck();
        themeInput.value = '';
        generateDeck();
    });

    // Initial deck generation
    loadImageScale();
    generateDeck();
});