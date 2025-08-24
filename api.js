import { withRetry } from './utils.js';

export async function safeImageGeneration(prompt, retries = 3) {
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

export async function safeFileUpload(file, retries = 3) {
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

export async function safeChatCompletion(messages, retries = 3) {
    return await withRetry(async () => {
        try {
            console.log('Attempting chat completion with messages:', JSON.stringify(messages, null, 2));
            
            const completion = await websim.chat.completions.create({
                model: "gpt-4o",
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

export async function safeImageFetch(url, retries = 3) {
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

