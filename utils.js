export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to copy error details to clipboard
export async function copyErrorToClipboard(errorDetails) {
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
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); z-index: 1000; display: flex;
        align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white; border-radius: 8px; padding: 20px;
        max-width: 800px; width: 100%; max-height: 80vh; overflow: auto;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Error Details (Copy this text)';
    title.style.marginTop = '0';
    
    const textarea = document.createElement('textarea');
    textarea.value = errorText;
    textarea.style.cssText = `
        width: 100%; height: 300px; font-family: monospace; font-size: 12px;
        padding: 10px; border: 1px solid #ccc; border-radius: 4px; resize: vertical;
    `;
    textarea.select();
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
        margin-top: 10px; padding: 8px 16px; background: #007bff;
        color: white; border: none; border-radius: 4px; cursor: pointer;
    `;
    closeBtn.onclick = () => document.body.removeChild(overlay);
    
    modal.appendChild(title);
    modal.appendChild(textarea);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

export async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
            
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`Waiting ${delay}ms before retry...`);
                await sleep(delay);
            } else {
                console.error(`All ${maxRetries} attempts failed. Last error:`, error);
            }
        }
    }
    
    throw lastError;
}