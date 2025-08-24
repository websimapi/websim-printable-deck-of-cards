import { ranks, suitSymbols } from './constants.js';
import { safeChatCompletion, safeImageGeneration } from './api.js';
import { sleep, copyErrorToClipboard } from './utils.js';

export async function applyTheme(app) {
    const { themeInput, loader, progressText, generateBtn, resetBtn, printBtn, cardDeck } = app;
    
    const theme = themeInput.value.trim();
    if (!theme) {
        alert('Please enter a theme.');
        return;
    }

    const cardsByRank = {};
    Array.from(cardDeck.children).forEach(card => {
        const rank = card.dataset.rank;
        if (!cardsByRank[rank]) {
            cardsByRank[rank] = [];
        }
        cardsByRank[rank].push(card);
    });

    loader.classList.remove('hidden');
    progressText.textContent = '';
    generateBtn.disabled = true;
    resetBtn.disabled = true;
    printBtn.disabled = true;

    let styleDescription = '';
    let successfulCards = 0;
    let failedCards = 0;
    let totalGenerated = 0;
    const totalCards = 52;

    try {
        progressText.textContent = 'Generating art style guide...';
        console.log('Generating art style for theme:', theme);
        const stylePrompt = `Create a concise but detailed art style guide for a deck of cards with the theme "${theme}". Describe the color palette, line style, and overall mood. The style should be suitable for simple, iconic card art. Example: "Minimalist vector art, thick outlines, limited color palette of dark blue, gold, and white, with a sophisticated and mystical mood."`;
        const descriptionCompletion = await safeChatCompletion([{ role: 'user', content: stylePrompt }]);
        styleDescription = descriptionCompletion.content;
        console.log('Generated style description:', styleDescription);
        
        await sleep(500);

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
            const superPrompt = completion.content;
            console.log(`Super prompt for ${rank}:`, superPrompt);
            await sleep(500);
            
            const cardsForRank = cardsByRank[rank] || [];
            for (const card of cardsForRank) {
                totalGenerated++;
                const suit = card.dataset.suit;
                progressText.textContent = `Generating card ${totalGenerated} of ${totalCards}... (${successfulCards} successful, ${failedCards} failed)`;
                
                let finalPrompt = superPrompt;
                const suitConcept = `a prominent, stylized ${suitSymbols[suit]} ${suit} symbol`;
                finalPrompt = finalPrompt.replace(/\[SUIT_CONCEPT\]/g, suitConcept);
                finalPrompt += `. The image must strictly adhere to this art style: "${styleDescription}"`;

                try {
                    const result = await safeImageGeneration(finalPrompt);
                    console.log(`Generated ${rankName} of ${suit}:`, result.url);
                    let centerSuit = card.querySelector('.center-suit');
                    if (centerSuit) {
                        centerSuit.innerHTML = `<img src="${result.url}" alt="Themed art for ${rank} of ${suit}">`;
                        successfulCards++;
                    }
                    if (totalGenerated < totalCards) await sleep(800);
                } catch (cardError) {
                    console.error(`Error generating image for ${rankName} of ${suit}:`, cardError);
                    failedCards++;
                    let centerSuit = card.querySelector('.center-suit');
                    if (centerSuit) {
                        centerSuit.innerHTML = `<span title="Generation failed: ${cardError.message}">⚠️</span>`;
                    }
                }
            }
        }
        
        const finalMessage = `Generation Complete! ${successfulCards} successful, ${failedCards} failed.`;
        progressText.textContent = finalMessage;
        console.log(finalMessage);

        if (failedCards > 0) {
            const statusDetails = `Theme Generation Complete\nSuccessful Cards: ${successfulCards}\nFailed Cards: ${failedCards}\nTheme: ${theme}\nStyle Description: ${styleDescription}\nBrowser: ${navigator.userAgent}\nTimestamp: ${new Date().toISOString()}\nNote: Some cards may have failed generation`;
            const color = failedCards > 0 ? '#856404' : '#28a745';
            const icon = failedCards > 0 ? '⚠️' : '✅';
            progressText.innerHTML = `<span style="color: ${color}; cursor: pointer; text-decoration: underline;" onclick="copyErrorToClipboard('${statusDetails.replace(/'/g, "\\'")}');">${icon} Click for details</span>`;
        }

    } catch (error) {
        console.error("Critical error during theme generation:", error);
        
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
        progressText.style.cssText = 'cursor: pointer; text-decoration: underline; color: #dc3545;';
        progressText.onclick = () => copyErrorToClipboard(errorDetails);
        copyErrorToClipboard(errorDetails);
        
    } finally {
        loader.classList.add('hidden');
        generateBtn.disabled = false;
        resetBtn.disabled = false;
        printBtn.disabled = false;
    }
}