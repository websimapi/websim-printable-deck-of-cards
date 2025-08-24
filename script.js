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

    async function runPromisesWithConcurrency(promiseFns, concurrency, onProgress) {
        const results = new Array(promiseFns.length);
        let completedCount = 0;
        let index = 0;
    
        async function worker() {
            while (index < promiseFns.length) {
                const currentIndex = index++;
                const promiseFn = promiseFns[currentIndex];
                if (promiseFn) {
                    try {
                        results[currentIndex] = await promiseFn();
                    } catch (error) {
                        results[currentIndex] = { error }; // Wrap error for identification
                    } finally {
                        completedCount++;
                        if (onProgress) {
                            onProgress(completedCount, promiseFns.length);
                        }
                    }
                }
            }
        }
    
        const workers = Array.from({ length: concurrency }, worker);
        await Promise.all(workers);
        return results;
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
                console.log('Attempting chat completion with messages:', JSON.stringify(messages, null, 2));
                
                const completion = await websim.chat.completions.create({
                    model: "gpt-4o", // Explicitly use a multimodal model
                    messages: messages,
                    json: messages.some(m => m.json === true), // Pass json flag if requested
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
        let superPrompts = {};
        let successfulCards = 0;
        let failedCards = 0;

        try {
            // STAGE 1: Generate a single art style guide for the whole deck.
            progressText.textContent = 'Generating art style guide...';
            console.log('Generating art style for theme:', theme);
            
            const stylePrompt = `Create a concise but detailed art style guide for a deck of cards with the theme "${theme}". Describe the color palette, line style, and overall mood. The style should be suitable for simple, iconic card art. Example: "Minimalist vector art, thick outlines, limited color palette of dark blue, gold, and white, with a sophisticated and mystical mood."`;
            
            const descriptionCompletion = await safeChatCompletion([{ role: 'user', content: stylePrompt }]);
            styleDescription = descriptionCompletion.content;
            console.log('Generated style description:', styleDescription);

            // STAGE 2: Generate all "super prompt" concepts for each rank in a single call.
            progressText.textContent = 'Generating concepts for all cards...';
            const rankNames = { 'A': 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten', 'J': 'Jack', 'Q': 'Queen', 'K': 'King' };

            const superPromptGenMessage = {
                role: 'user',
                json: true,
                content: `
You are a creative assistant for generating playing card art.
The user's theme is: "${theme}".
The overall art style is: "${styleDescription}".

Your task is to create a detailed "super prompt" for EACH card rank (A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K). This prompt will be used to generate an image.

- The prompt for each rank should describe a unique visual concept that fits the theme and style.
- CRUCIALLY, each prompt must be suit-agnostic. It must include the placeholder "[SUIT_CONCEPT]" where a visual representation of the suit should be incorporated.
- The prompt must NOT contain any text or letters to be rendered in the image.
- The final prompt for each rank should be a single, coherent paragraph focused on visual description.

Respond directly with a single JSON object. The keys should be the rank characters ('A', '2', '..._EXISTING_RANKS_...', 'K') and the values should be the generated super prompts.
Example for a 'cats' theme:
{
  "A": "A majestic cat monarch sitting on a throne, with a large [SUIT_CONCEPT] emblem on the tapestry behind it. Regal, powerful, and detailed.",
  "2": "Two playful kittens batting at a ball of yarn that unravels to form the shape of a [SUIT_CONCEPT]."
}
`,
            };

            const completion = await safeChatCompletion([superPromptGenMessage]);
            superPrompts = JSON.parse(completion.content);
            console.log(`Generated all super prompts:`, superPrompts);


            // STAGE 3: Generate all 52 cards in parallel batches.
            const generationTasks = cards.map(card => async () => {
                const rank = card.dataset.rank;
                const suit = card.dataset.suit;
                
                let finalPrompt = superPrompts[rank];
                if (!finalPrompt) {
                    throw new Error(`No super prompt found for rank ${rank}`);
                }
                
                const suitConcept = `a prominent, stylized ${suitSymbols[suit]} ${suit} symbol`;
                finalPrompt = finalPrompt.replace(/\[SUIT_CONCEPT\]/g, suitConcept);
                finalPrompt += `. The image must strictly adhere to this art style: "${styleDescription}"`;

                const result = await safeImageGeneration(finalPrompt);
                
                let centerSuit = card.querySelector('.center-suit');
                if (centerSuit) {
                    centerSuit.innerHTML = `<img src="${result.url}" alt="Themed art for ${rank} of ${suit}">`;
                }
            });

            const concurrency = 5; // Generate 5 images at a time
            await runPromisesWithConcurrency(generationTasks, concurrency, (completed, total) => {
                const currentSuccessful = completed - failedCards;
                progressText.textContent = `Generating card ${completed} of ${total}... (${currentSuccessful} successful, ${failedCards} failed)`;
            });

            // Final count after all tasks are processed
            successfulCards = cards.filter(c => c.querySelector('.center-suit img')).length;
            failedCards = 52 - successfulCards;
            
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
    resetBtn.addEventListener('click', generateDeck);

    // Initial deck generation
    generateDeck();
});