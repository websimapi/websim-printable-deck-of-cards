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

            // 2. Analyze the image for style consistency - this is now critical and cannot be skipped
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

            // Add a longer delay before AI analysis to ensure file is ready
            await sleep(3000);

            // 3. Get a detailed description of the generated image using the uploaded URL
            progressText.textContent = 'Analyzing art style...';
            
            const messages = [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Describe the art style of this image for a consistent theme. Focus on style, color palette, and line work. Be concise.' },
                    { type: 'image_url', image_url: { url: uploadedUrl } },
                ],
            }];

            console.log('About to call safeChatCompletion with uploaded URL:', uploadedUrl);
            const descriptionCompletion = await safeChatCompletion(messages);
            styleDescription = descriptionCompletion.content;
            console.log('Generated style description:', styleDescription);

            // Add delay before starting batch generation
            await sleep(1500);

            // 4. Generate the rest of the cards one by one using style-guided approach
            const otherCards = cards.filter(c => !(c.dataset.suit === 'hearts' && c.dataset.rank === 'A'));
            
            for (let i = 0; i < otherCards.length; i++) {
                const card = otherCards[i];
                const cardNumber = i + 2;
                progressText.textContent = `Generating card ${cardNumber} of 52... (${successfulCards} successful, ${failedCards} failed)`;

                const rank = card.dataset.rank;
                const suit = card.dataset.suit;
                const rankName = { 'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack' }[rank] || rank;
                
                // Always use style-guided prompts
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