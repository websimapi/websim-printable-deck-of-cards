import { generateDeck } from './ui.js';
import { applyTheme } from './theme.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const cardDeck = document.getElementById('card-deck');
    const printBtn = document.getElementById('print-btn');
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const themeInput = document.getElementById('theme-input');
    const loader = document.getElementById('loader');
    const progressText = document.getElementById('progress-text');

    // State object to pass to modules
    const app = {
        cardDeck,
        printBtn,
        generateBtn,
        resetBtn,
        themeInput,
        loader,
        progressText
    };
    
    // Event Listeners
    printBtn.addEventListener('click', () => window.print());
    generateBtn.addEventListener('click', () => applyTheme(app));
    resetBtn.addEventListener('click', () => generateDeck(app.cardDeck));

    // Initial deck generation
    generateDeck(app.cardDeck);
});