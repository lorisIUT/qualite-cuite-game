/**
 * Main - Point d'entrée du jeu
 */
import { Game } from './core/Game.js';

// Attend que le DOM soit chargé
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');

    if (!canvas) {
        console.error('Canvas not found!');
        return;
    }

    // Crée et démarre le jeu
    const game = new Game(canvas);

    // Expose le jeu pour le debug (optionnel)
    window.game = game;

    // Lance le jeu
    game.start().then(() => {
        console.log('🥙 The Qualité Cuite Game loaded!');
    });
});
