/**
 * Game - Classe principale du jeu avec inventaire, scores et high scores
 */
import { InputManager } from './InputManager.js';
import { AssetLoader } from './AssetLoader.js';
import { Player } from '../entities/Player.js';
import { Item, ItemType } from '../entities/Item.js';
import { GameMap } from '../world/GameMap.js';
import { ZoneType } from '../world/Zone.js';
import { CustomerManager } from '../systems/CustomerManager.js';
import { LevelManager, LevelState, Difficulty, DifficultyConfig } from '../systems/LevelManager.js';
import { ScoreManager } from '../systems/ScoreManager.js';

// États du menu
const MenuState = {
    MAIN: 'main',
    HIGH_SCORES: 'highScores'
};

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Taille du jeu
        this.width = 600;
        this.height = 500;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // État
        this.lastTime = 0;

        // Systèmes core
        this.inputManager = new InputManager();
        this.assetLoader = new AssetLoader();
        this.scoreManager = new ScoreManager();

        // Monde
        this.gameMap = new GameMap(this.width, this.height);

        // Entités
        this.player = null;

        // Systèmes
        this.customerManager = new CustomerManager(this.gameMap);
        this.levelManager = new LevelManager();

        // Sync customers lost
        this.customerManager.onCustomerAngry = () => {
            this.levelManager.addLostCustomer();
            this.showFeedback('Client perdu !', '#f44336');
        };

        // Menu
        this.menuState = MenuState.MAIN;
        this.selectedOption = 0;
        this.difficulties = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD];

        // High scores view
        this.highScoresDifficulty = 0;

        // Feedback visuel
        this.feedbackMessage = null;
        this.feedbackTimer = 0;

        // Dernier score (pour affichage fin de partie)
        this.lastGameScore = 0;
        this.lastGameRank = -1;

        this.setupInputHandlers();
    }

    /**
     * Réinitialise le joueur
     */
    resetPlayer() {
        this.player = new Player(
            this.width / 2 - 20,
            this.gameMap.counterZone.y - 100
        );
    }

    /**
     * Configure les handlers d'input
     */
    setupInputHandlers() {
        // Touche E pour interaction
        this.inputManager.onKeyDown('e', () => this.handleInteraction());

        // Navigation menu
        this.inputManager.onKeyDown('z', () => this.handleMenuNavigation(-1));
        this.inputManager.onKeyDown('s', () => this.handleMenuNavigation(1));
        this.inputManager.onKeyDown('q', () => this.handleMenuHorizontal(-1));
        this.inputManager.onKeyDown('d', () => this.handleMenuHorizontal(1));

        // Echap pour retour menu
        this.inputManager.onKeyDown('escape', () => {
            if (this.levelManager.state !== LevelState.MENU) {
                this.levelManager.returnToMenu();
                this.customerManager.reset();
                if (this.player) this.player.clearInventory();
            } else if (this.menuState === MenuState.HIGH_SCORES) {
                this.menuState = MenuState.MAIN;
                this.selectedOption = 0;
            }
        });

        // Touche F pour jeter un objet
        this.inputManager.onKeyDown('f', () => this.handleDropItem());
    }

    /**
     * Jette le dernier item de l'inventaire
     */
    handleDropItem() {
        if (this.levelManager.state !== LevelState.PLAYING || !this.player) return;

        const droppedItem = this.player.dropItem();
        if (droppedItem) {
            this.showFeedback('Item jeté !', '#795548');
        }
    }

    /**
     * Navigation verticale dans le menu
     */
    handleMenuNavigation(direction) {
        if (this.levelManager.state === LevelState.MENU && this.menuState === MenuState.MAIN) {
            // 4 options: 3 difficultés + high scores
            this.selectedOption += direction;
            if (this.selectedOption < 0) this.selectedOption = 3;
            if (this.selectedOption > 3) this.selectedOption = 0;
        }
    }

    /**
     * Navigation horizontale (pour les high scores)
     */
    handleMenuHorizontal(direction) {
        if (this.menuState === MenuState.HIGH_SCORES) {
            this.highScoresDifficulty += direction;
            if (this.highScoresDifficulty < 0) this.highScoresDifficulty = 2;
            if (this.highScoresDifficulty > 2) this.highScoresDifficulty = 0;
        }
    }

    /**
     * Gère l'interaction (E)
     */
    handleInteraction() {
        // Menu principal
        if (this.levelManager.state === LevelState.MENU) {
            if (this.menuState === MenuState.MAIN) {
                if (this.selectedOption < 3) {
                    // Lancer un niveau
                    this.startLevel(this.difficulties[this.selectedOption]);
                } else {
                    // Voir les high scores
                    this.menuState = MenuState.HIGH_SCORES;
                    this.highScoresDifficulty = 0;
                }
            } else if (this.menuState === MenuState.HIGH_SCORES) {
                // Retour au menu principal
                this.menuState = MenuState.MAIN;
            }
            return;
        }

        // Écran de fin -> Retour menu
        if (this.levelManager.state === LevelState.WON ||
            this.levelManager.state === LevelState.LOST) {
            this.levelManager.returnToMenu();
            this.customerManager.reset();
            this.menuState = MenuState.MAIN;
            this.selectedOption = 0;
            return;
        }

        // En jeu
        if (this.levelManager.state !== LevelState.PLAYING) return;

        const playerZone = this.gameMap.getPlayerZone(this.player);

        // Si près du comptoir avec des items, essayer de servir
        if (this.player.isHoldingItem() && this.customerManager.isPlayerNearCounter(this.player)) {
            this.tryServeCustomers();
            return;
        }

        // Sinon, essayer de prendre un item
        if (playerZone && !this.player.isInventoryFull()) {
            if (playerZone.type === ZoneType.KEBAB_STATION) {
                const kebab = new Item(ItemType.KEBAB);
                this.player.pickUp(kebab);
                this.showFeedback('Kebab pris !', '#8d4a2c');
            } else if (playerZone.type === ZoneType.DRINK_STATION) {
                const drink = new Item(ItemType.DRINK);
                this.player.pickUp(drink);
                this.showFeedback('Boisson prise !', '#1565c0');
            }
        } else if (this.player.isInventoryFull()) {
            this.showFeedback('Inventaire plein !', '#ff9800');
        }
    }

    /**
     * Essaie de servir les clients avec les items de l'inventaire
     */
    tryServeCustomers() {
        let totalPoints = 0;
        let itemsDelivered = 0;
        let ordersCompleted = 0;

        // Essaie de livrer chaque item de l'inventaire
        for (let i = this.player.inventory.length - 1; i >= 0; i--) {
            const item = this.player.inventory[i];
            const result = this.customerManager.tryServeCustomer(this.player, item);

            if (result.success && result.correct) {
                this.player.inventory.splice(i, 1);
                itemsDelivered++;

                if (result.completed) {
                    // Bonus pour commande complète: score = nombre d'items × 2
                    totalPoints += result.orderSize * 2;
                    ordersCompleted++;
                } else {
                    totalPoints += 1;
                }
            }
        }

        if (itemsDelivered > 0) {
            this.levelManager.addScore(totalPoints);
            if (ordersCompleted > 0) {
                this.showFeedback(`+${totalPoints} pts ! ${ordersCompleted} commande(s) !`, '#4caf50');
            } else {
                this.showFeedback(`+${totalPoints} pt(s)`, '#4caf50');
            }
        } else if (this.player.isHoldingItem()) {
            this.showFeedback('Personne ne veut ça !', '#f44336');
        }
    }

    /**
     * Démarre un niveau
     */
    startLevel(difficulty) {
        this.resetPlayer();
        this.customerManager.reset();
        this.levelManager.startLevel(difficulty);

        const config = DifficultyConfig[difficulty];
        this.customerManager.configure(config.maxCustomers, config.customerSpawnDelay, config.customerPatience);
    }

    /**
     * Affiche un message de feedback
     */
    showFeedback(message, color) {
        this.feedbackMessage = message;
        this.feedbackColor = color;
        this.feedbackTimer = 1.5;
    }

    /**
     * Initialise et lance le jeu
     */
    async start() {
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Boucle de jeu principale
     */
    gameLoop(currentTime) {
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        const clampedDelta = Math.min(deltaTime, 0.1);

        this.update(clampedDelta);
        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Met à jour la logique du jeu
     */
    update(deltaTime) {
        const previousState = this.levelManager.state;

        // Update level manager (timer)
        this.levelManager.update(deltaTime);

        // Détecte fin de partie pour sauvegarder le score
        if (previousState === LevelState.PLAYING &&
            (this.levelManager.state === LevelState.WON || this.levelManager.state === LevelState.LOST)) {
            this.lastGameScore = this.levelManager.score;
            this.lastGameRank = this.scoreManager.saveScore(
                this.levelManager.difficulty,
                this.levelManager.score,
                this.customerManager.customersServed,
                this.levelManager.timeRemaining
            );
        }

        if (this.levelManager.state === LevelState.PLAYING && this.player) {
            this.player.update(deltaTime, this.inputManager, this.gameMap);
            this.customerManager.update(deltaTime);
        }

        if (this.feedbackTimer > 0) {
            this.feedbackTimer -= deltaTime;
        }
    }

    /**
     * Rendu du jeu
     */
    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        switch (this.levelManager.state) {
            case LevelState.MENU:
                if (this.menuState === MenuState.MAIN) {
                    this.renderMenu();
                } else {
                    this.renderHighScores();
                }
                break;
            case LevelState.PLAYING:
                this.renderGame();
                break;
            case LevelState.WON:
                this.renderGame();
                this.renderEndScreen(true);
                break;
            case LevelState.LOST:
                this.renderGame();
                this.renderEndScreen(false);
                break;
        }
    }

    /**
     * Rendu du menu principal
     */
    renderMenu() {
        // Fond
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Titre
        this.ctx.fillStyle = '#ff6b35';
        this.ctx.font = '20px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        this.ctx.shadowColor = '#ff6b35';
        this.ctx.shadowBlur = 20;
        this.ctx.fillText('THE QUALITÉ', this.width / 2, 60);
        this.ctx.fillText('CUITE GAME', this.width / 2, 90);
        this.ctx.shadowBlur = 0;

        // Options
        const startY = 160;
        const spacing = 60;

        // Difficultés
        this.difficulties.forEach((diff, index) => {
            const config = DifficultyConfig[diff];
            const y = startY + index * spacing;
            const isSelected = index === this.selectedOption;
            const bestScore = this.scoreManager.getBestScore(diff);

            this.ctx.fillStyle = isSelected ? config.color : 'rgba(255,255,255,0.1)';
            this.ctx.beginPath();
            this.ctx.roundRect(this.width / 2 - 150, y - 22, 300, 44, 10);
            this.ctx.fill();

            this.ctx.fillStyle = isSelected ? '#fff' : '#888';
            this.ctx.font = '12px "Press Start 2P", monospace';
            this.ctx.fillText(config.name, this.width / 2, y - 5);

            this.ctx.font = '8px "Press Start 2P", monospace';
            this.ctx.fillText(`Record: ${bestScore} pts`, this.width / 2, y + 12);

            if (isSelected) {
                this.ctx.fillStyle = '#fff';
                this.ctx.fillText('▶', this.width / 2 - 135, y - 5);
                this.ctx.fillText('◀', this.width / 2 + 135, y - 5);
            }
        });

        // Bouton High Scores
        const hsY = startY + 3 * spacing;
        const isHsSelected = this.selectedOption === 3;

        this.ctx.fillStyle = isHsSelected ? '#9c27b0' : 'rgba(255,255,255,0.1)';
        this.ctx.beginPath();
        this.ctx.roundRect(this.width / 2 - 150, hsY - 22, 300, 44, 10);
        this.ctx.fill();

        this.ctx.fillStyle = isHsSelected ? '#fff' : '#888';
        this.ctx.font = '12px "Press Start 2P", monospace';
        this.ctx.fillText('🏆 HIGH SCORES', this.width / 2, hsY);

        if (isHsSelected) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '8px "Press Start 2P", monospace';
            this.ctx.fillText('▶', this.width / 2 - 135, hsY);
            this.ctx.fillText('◀', this.width / 2 + 135, hsY);
        }

        // Instructions
        this.ctx.fillStyle = '#666';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.fillText('Z/S naviguer - E sélectionner', this.width / 2, 460);
    }

    /**
     * Rendu de la page des high scores
     */
    renderHighScores() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Titre
        this.ctx.fillStyle = '#ffd700';
        this.ctx.font = '18px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🏆 HIGH SCORES 🏆', this.width / 2, 50);

        // Onglets de difficulté
        const tabY = 95;
        this.difficulties.forEach((diff, index) => {
            const config = DifficultyConfig[diff];
            const tabX = this.width / 2 + (index - 1) * 150;
            const isSelected = index === this.highScoresDifficulty;

            this.ctx.fillStyle = isSelected ? config.color : 'rgba(255,255,255,0.2)';
            this.ctx.beginPath();
            this.ctx.roundRect(tabX - 60, tabY - 15, 120, 30, 5);
            this.ctx.fill();

            this.ctx.fillStyle = isSelected ? '#fff' : '#888';
            this.ctx.font = '10px "Press Start 2P", monospace';
            this.ctx.fillText(config.name, tabX, tabY);
        });

        // Scores
        const diff = this.difficulties[this.highScoresDifficulty];
        const highScores = this.scoreManager.getHighScores();
        const scores = highScores[diff] || [];

        const startY = 160;
        const spacing = 50;

        if (scores.length === 0) {
            this.ctx.fillStyle = '#666';
            this.ctx.font = '10px "Press Start 2P", monospace';
            this.ctx.fillText('Aucun score enregistré', this.width / 2, 250);
        } else {
            scores.forEach((entry, index) => {
                const y = startY + index * spacing;
                const medals = ['🥇', '🥈', '🥉', '4.', '5.'];

                // Fond
                this.ctx.fillStyle = index === 0 ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)';
                this.ctx.beginPath();
                this.ctx.roundRect(50, y - 18, this.width - 100, 36, 8);
                this.ctx.fill();

                // Rang
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '14px "Press Start 2P", monospace';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(medals[index], 70, y);

                // Score
                this.ctx.font = '12px "Press Start 2P", monospace';
                this.ctx.fillText(`${entry.score} pts`, 120, y);

                // Clients servis
                this.ctx.fillStyle = '#888';
                this.ctx.font = '8px "Press Start 2P", monospace';
                this.ctx.textAlign = 'right';
                this.ctx.fillText(`${entry.customersServed} clients`, this.width - 70, y);
            });
        }

        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#666';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.fillText('Q/D changer - E ou ESC retour', this.width / 2, 460);
    }

    /**
     * Rendu du jeu
     */
    renderGame() {
        this.gameMap.render(this.ctx);

        if (this.player) {
            const playerZone = this.gameMap.getPlayerZone(this.player);
            this.gameMap.renderInteractionHints(this.ctx, playerZone);
        }

        this.customerManager.render(this.ctx);

        if (this.player) {
            this.player.render(this.ctx);
        }

        this.renderHUD();

        if (this.player && this.player.isHoldingItem() &&
            this.customerManager.isPlayerNearCounter(this.player)) {
            this.renderServeHint();
        }

        if (this.feedbackTimer > 0) {
            this.renderFeedback();
        }
    }

    /**
     * Rendu du HUD
     */
    renderHUD() {
        const config = this.levelManager.config;
        if (!config) return;

        // Fond du HUD
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.width, 50);

        // Timer
        this.ctx.fillStyle = this.levelManager.timeRemaining < 30 ? '#f44336' : '#fff';
        this.ctx.font = '12px "Press Start 2P", monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`⏱ ${this.levelManager.getFormattedTime()}`, 15, 18);

        // Score (infini)
        this.ctx.fillStyle = '#ffd700';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`${this.levelManager.score} pts`, this.width - 15, 18);

        // Indicateur de clients perdus (au milieu)
        const lostCount = this.levelManager.customersLost;
        const maxLost = this.levelManager.maxLostCustomers;
        const width = 200;
        const x = (this.width - width) / 2;

        // Label
        this.ctx.fillStyle = '#f44336';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`CLIENTS PERDUS: ${lostCount}/${maxLost}`, this.width / 2, 12);

        // Barres de vie (clients perdus)
        const heartSize = 10;
        const spacing = 15;
        const startX = this.width / 2 - ((maxLost - 1) * spacing) / 2;

        for (let i = 0; i < maxLost; i++) {
            this.ctx.fillStyle = i < (maxLost - lostCount) ? '#4caf50' : '#333';
            this.ctx.beginPath();
            this.ctx.arc(startX + i * spacing, 25, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Inventaire
        this.renderInventoryHUD();
    }

    /**
     * Affiche l'inventaire dans le HUD
     */
    renderInventoryHUD() {
        if (!this.player) return;

        const startX = 15;
        const y = 38;

        // Texte inventaire
        this.ctx.fillStyle = '#888';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('INV:', startX, y);

        // Slots
        for (let i = 0; i < this.player.maxInventory; i++) {
            const slotX = startX + 45 + i * 28;

            // Fond du slot
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.beginPath();
            this.ctx.roundRect(slotX, y - 10, 24, 20, 4);
            this.ctx.fill();

            // Item
            if (i < this.player.inventory.length) {
                const item = this.player.inventory[i];
                Item.renderIcon(this.ctx, item.type, slotX + 12, y, 16);
            }
        }

        // Indicateur de vitesse
        const speedPercent = Math.round((this.player.getCurrentSpeed() / this.player.baseSpeed) * 100);
        this.ctx.fillStyle = speedPercent < 70 ? '#f44336' : '#4caf50';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`⚡${speedPercent}%`, this.width - 15, y);
    }

    /**
     * Rendu de l'écran de fin
     */
    renderEndScreen(won) {
        this.ctx.fillStyle = won ? 'rgba(76, 175, 80, 0.95)' : 'rgba(244, 67, 54, 0.95)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        if (won) {
            this.ctx.fillText('FIN DE SERVICE !', this.width / 2, this.height / 2 - 60);

            // Nouveau record ?
            if (this.lastGameRank === 1) {
                this.ctx.fillStyle = '#ffd700';
                this.ctx.font = '14px "Press Start 2P", monospace';
                this.ctx.fillText('🏆 NOUVEAU RECORD ! 🏆', this.width / 2, this.height / 2 - 20);
            }

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px "Press Start 2P", monospace';
            this.ctx.fillText(`Score Final: ${this.levelManager.score} pts`, this.width / 2, this.height / 2 + 20);
            this.ctx.fillText(`Clients satisfaits: ${this.customerManager.customersServed}`, this.width / 2, this.height / 2 + 50);
        } else {
            this.ctx.fillText('PERDU !', this.width / 2, this.height / 2 - 60);

            this.ctx.fillStyle = '#f44336';
            this.ctx.font = '10px "Press Start 2P", monospace';
            this.ctx.fillText('Trop de clients mécontents !', this.width / 2, this.height / 2 - 20);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px "Press Start 2P", monospace';
            this.ctx.fillText(`Score Final: ${this.levelManager.score} pts`, this.width / 2, this.height / 2 + 20);
        }

        this.ctx.font = '10px "Press Start 2P", monospace';
        this.ctx.fillText('Appuie sur E pour continuer', this.width / 2, this.height / 2 + 100);
    }

    /**
     * Dessine l'indicateur de service
     */
    renderServeHint() {
        const cx = this.width / 2;
        const cy = this.gameMap.counterZone.y + 10;

        this.ctx.fillStyle = 'rgba(76, 175, 80, 0.9)';
        this.ctx.beginPath();
        this.ctx.roundRect(cx - 70, cy - 12, 140, 24, 5);
        this.ctx.fill();

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('E pour servir', cx, cy);
    }

    /**
     * Dessine le message de feedback
     */
    renderFeedback() {
        const alpha = Math.min(1, this.feedbackTimer);
        const y = 75 - (1 - alpha) * 20;

        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = this.feedbackColor;
        this.ctx.font = '12px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(this.feedbackMessage, this.width / 2, y);
        this.ctx.shadowBlur = 0;

        this.ctx.globalAlpha = 1;
    }
}
