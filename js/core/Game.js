/**
 * Game - Classe principale du jeu avec multijoueur réseau
 */
import { InputManager } from './InputManager.js';
import { AssetLoader } from './AssetLoader.js';
import { Player, PlayerColors } from '../entities/Player.js';
import { Item, ItemType } from '../entities/Item.js';
import { GameMap } from '../world/GameMap.js';
import { ZoneType } from '../world/Zone.js';
import { CustomerManager } from '../systems/CustomerManager.js';
import { LevelManager, LevelState, Difficulty, DifficultyConfig } from '../systems/LevelManager.js';
import { ScoreManager } from '../systems/ScoreManager.js';
import { NetworkManager, NetworkRole, NetworkState } from '../systems/NetworkManager.js';

// États du menu
const MenuState = {
    MAIN: 'main',
    HIGH_SCORES: 'highScores',
    MULTI_MENU: 'multiMenu',
    LOBBY_HOST: 'lobbyHost',
    LOBBY_JOIN: 'lobbyJoin'
};

// Mode de jeu
const GameMode = {
    SOLO: 'solo',
    MULTI_HOST: 'multiHost',
    MULTI_CLIENT: 'multiClient'
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
        this.gameMode = GameMode.SOLO;

        // Systèmes core
        this.inputManager = new InputManager();
        this.assetLoader = new AssetLoader();
        this.scoreManager = new ScoreManager();
        this.networkManager = new NetworkManager();

        // Monde
        this.gameMap = new GameMap(this.width, this.height);

        // Joueurs
        this.localPlayer = null;
        this.remotePlayer = null;

        // Alias pour compatibilité
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
        this.selectedDifficulty = 0;

        // High scores view
        this.highScoresDifficulty = 0;

        // Lobby
        this.joinCodeInput = '';
        this.lobbyError = null;

        // Feedback visuel
        this.feedbackMessage = null;
        this.feedbackTimer = 0;

        // Dernier score
        this.lastGameScore = 0;
        this.lastGameRank = -1;

        // Network sync timer
        this.networkSyncTimer = 0;
        this.networkSyncInterval = 1 / 15; // 15 updates/sec

        this.setupInputHandlers();
        this.setupNetworkHandlers();
    }

    /**
     * Configure les handlers réseau
     */
    setupNetworkHandlers() {
        this.networkManager.onPlayerJoined = () => {
            this.showFeedback('Joueur 2 connecté !', '#4caf50');
        };

        this.networkManager.onPlayerLeft = () => {
            this.showFeedback('Joueur 2 déconnecté', '#f44336');
            this.returnToMenu();
        };

        this.networkManager.onGameStart = (data) => {
            // Client reçoit le signal de démarrage
            this.startMultiplayerGame(data.difficulty);
        };

        this.networkManager.onGameData = (data) => {
            // Client reçoit l'état du jeu depuis l'host
            this.handleGameStateFromHost(data);
        };
    }

    /**
     * Réinitialise les joueurs
     */
    resetPlayers() {
        const startY = this.gameMap.counterZone.y - 100;

        if (this.gameMode === GameMode.SOLO) {
            this.localPlayer = new Player(this.width / 2 - 20, startY, 1);
            this.remotePlayer = null;
        } else if (this.gameMode === GameMode.MULTI_HOST) {
            this.localPlayer = new Player(this.width / 2 - 60, startY, 1);
            this.remotePlayer = new Player(this.width / 2 + 20, startY, 2);
            this.remotePlayer.isRemote = true;
        } else if (this.gameMode === GameMode.MULTI_CLIENT) {
            this.localPlayer = new Player(this.width / 2 + 20, startY, 2);
            this.remotePlayer = new Player(this.width / 2 - 60, startY, 1);
            this.remotePlayer.isRemote = true;
        }

        this.player = this.localPlayer; // Alias
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
        this.inputManager.onKeyDown('escape', () => this.handleEscape());

        // Touche F pour jeter un objet
        this.inputManager.onKeyDown('f', () => this.handleDropItem());

        // Backspace pour effacer le code
        this.inputManager.onKeyDown('backspace', () => {
            if (this.menuState === MenuState.LOBBY_JOIN) {
                this.joinCodeInput = this.joinCodeInput.slice(0, -1);
            }
        });
    }

    /**
     * Gère l'échappement
     */
    handleEscape() {
        if (this.levelManager.state !== LevelState.MENU) {
            this.returnToMenu();
        } else if (this.menuState !== MenuState.MAIN) {
            this.networkManager.disconnect();
            this.menuState = MenuState.MAIN;
            this.selectedOption = 0;
            this.joinCodeInput = '';
            this.lobbyError = null;
        }
    }

    /**
     * Retourne au menu
     */
    returnToMenu() {
        this.levelManager.returnToMenu();
        this.customerManager.reset();
        if (this.localPlayer) this.localPlayer.clearInventory();
        this.networkManager.disconnect();
        this.menuState = MenuState.MAIN;
        this.selectedOption = 0;
        this.gameMode = GameMode.SOLO;
    }

    /**
     * Navigation verticale dans le menu
     */
    handleMenuNavigation(direction) {
        if (this.levelManager.state !== LevelState.MENU) return;

        if (this.menuState === MenuState.MAIN) {
            // 4 options: Solo, Multi, High Scores
            this.selectedOption += direction;
            if (this.selectedOption < 0) this.selectedOption = 3;
            if (this.selectedOption > 3) this.selectedOption = 0;
        } else if (this.menuState === MenuState.MULTI_MENU) {
            // 2 options: Créer, Rejoindre
            this.selectedOption += direction;
            if (this.selectedOption < 0) this.selectedOption = 1;
            if (this.selectedOption > 1) this.selectedOption = 0;
        } else if (this.menuState === MenuState.LOBBY_HOST) {
            // Navigation difficulté
            this.selectedDifficulty += direction;
            if (this.selectedDifficulty < 0) this.selectedDifficulty = 2;
            if (this.selectedDifficulty > 2) this.selectedDifficulty = 0;
        }
    }

    /**
     * Navigation horizontale
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
            this.handleMenuInteraction();
            return;
        }

        // Écran de fin -> Retour menu
        if (this.levelManager.state === LevelState.WON ||
            this.levelManager.state === LevelState.LOST) {
            this.returnToMenu();
            return;
        }

        // En jeu
        if (this.levelManager.state !== LevelState.PLAYING) return;
        if (!this.localPlayer) return;

        const playerZone = this.gameMap.getPlayerZone(this.localPlayer);

        // Si près du comptoir avec des items, essayer de servir
        if (this.localPlayer.isHoldingItem() && this.customerManager.isPlayerNearCounter(this.localPlayer)) {
            this.tryServeCustomers(this.localPlayer);
            return;
        }

        // Sinon, essayer de prendre un item
        if (playerZone && !this.localPlayer.isInventoryFull()) {
            if (playerZone.type === ZoneType.KEBAB_STATION) {
                const kebab = new Item(ItemType.KEBAB);
                this.localPlayer.pickUp(kebab);
                this.showFeedback('Kebab pris !', '#8d4a2c');
            } else if (playerZone.type === ZoneType.DRINK_STATION) {
                const drink = new Item(ItemType.DRINK);
                this.localPlayer.pickUp(drink);
                this.showFeedback('Boisson prise !', '#1565c0');
            }
        } else if (this.localPlayer.isInventoryFull()) {
            this.showFeedback('Inventaire plein !', '#ff9800');
        }
    }

    /**
     * Gère les interactions menu
     */
    handleMenuInteraction() {
        if (this.menuState === MenuState.MAIN) {
            if (this.selectedOption === 0) {
                // Solo - sélection difficulté directe (simplifié)
                this.gameMode = GameMode.SOLO;
                this.startSoloGame(Difficulty.MEDIUM);
            } else if (this.selectedOption === 1) {
                // Multijoueur
                this.menuState = MenuState.MULTI_MENU;
                this.selectedOption = 0;
            } else if (this.selectedOption === 2) {
                // High Scores
                this.menuState = MenuState.HIGH_SCORES;
                this.highScoresDifficulty = 0;
            } else if (this.selectedOption === 3) {
                // Difficulté toggle pour solo
                this.gameMode = GameMode.SOLO;
                this.startSoloGame(Difficulty.HARD);
            }
        } else if (this.menuState === MenuState.MULTI_MENU) {
            if (this.selectedOption === 0) {
                // Créer partie
                this.hostGame();
            } else if (this.selectedOption === 1) {
                // Rejoindre
                this.menuState = MenuState.LOBBY_JOIN;
                this.joinCodeInput = '';
                this.lobbyError = null;
            }
        } else if (this.menuState === MenuState.HIGH_SCORES) {
            this.menuState = MenuState.MAIN;
        } else if (this.menuState === MenuState.LOBBY_HOST) {
            // Lancer la partie si joueur 2 connecté
            if (this.networkManager.state === NetworkState.CONNECTED) {
                const difficulty = this.difficulties[this.selectedDifficulty];
                this.networkManager.startGame(difficulty);
                this.startMultiplayerGame(difficulty);
            }
        } else if (this.menuState === MenuState.LOBBY_JOIN) {
            // Tenter de rejoindre
            if (this.joinCodeInput.length === 6) {
                this.joinGame(this.joinCodeInput);
            }
        }
    }

    /**
     * Héberge une partie
     */
    async hostGame() {
        this.menuState = MenuState.LOBBY_HOST;
        this.lobbyError = null;
        this.gameMode = GameMode.MULTI_HOST;

        try {
            await this.networkManager.hostGame();
        } catch (err) {
            this.lobbyError = 'Erreur de connexion';
            console.error(err);
        }
    }

    /**
     * Rejoint une partie
     */
    async joinGame(code) {
        this.lobbyError = null;
        this.gameMode = GameMode.MULTI_CLIENT;

        try {
            await this.networkManager.joinGame(code);
            // En attente du signal de démarrage de l'host
        } catch (err) {
            this.lobbyError = 'Code invalide ou partie non trouvée';
            this.gameMode = GameMode.SOLO;
            console.error(err);
        }
    }

    /**
     * Démarre une partie solo
     */
    startSoloGame(difficulty) {
        this.gameMode = GameMode.SOLO;
        this.resetPlayers();
        this.customerManager.reset();
        this.levelManager.startLevel(difficulty);

        const config = DifficultyConfig[difficulty];
        this.customerManager.configure(config.maxCustomers, config.customerSpawnDelay, config.customerPatience);
    }

    /**
     * Démarre une partie multijoueur
     */
    startMultiplayerGame(difficulty) {
        this.resetPlayers();
        this.customerManager.reset();
        this.levelManager.startLevel(difficulty);
        this.levelManager.setMultiplayer(true);

        const config = DifficultyConfig[difficulty];
        // Plus de clients et spawn plus rapide en multi
        this.customerManager.configure(
            config.maxCustomers + 1,
            Math.floor(config.customerSpawnDelay * 0.8),
            config.customerPatience
        );
    }

    /**
     * Jette le dernier item
     */
    handleDropItem() {
        if (this.levelManager.state !== LevelState.PLAYING || !this.localPlayer) return;

        const droppedItem = this.localPlayer.dropItem();
        if (droppedItem) {
            this.showFeedback('Item jeté !', '#795548');
        }
    }

    /**
     * Essaie de servir les clients
     */
    tryServeCustomers(player) {
        let totalPoints = 0;
        let itemsDelivered = 0;
        let ordersCompleted = 0;

        for (let i = player.inventory.length - 1; i >= 0; i--) {
            const item = player.inventory[i];
            const result = this.customerManager.tryServeCustomer(player, item);

            if (result.success && result.correct) {
                player.inventory.splice(i, 1);
                itemsDelivered++;

                if (result.completed) {
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
        } else if (player.isHoldingItem()) {
            this.showFeedback('Personne ne veut ça !', '#f44336');
        }
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
        // Configure la saisie de texte pour le code
        window.addEventListener('keydown', (e) => {
            if (this.menuState === MenuState.LOBBY_JOIN) {
                if (e.key.length === 1 && e.key.match(/[a-zA-Z0-9]/)) {
                    if (this.joinCodeInput.length < 6) {
                        this.joinCodeInput += e.key.toUpperCase();
                    }
                }
            }
        });

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

        this.levelManager.update(deltaTime);

        // Détecte fin de partie
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

        if (this.levelManager.state === LevelState.PLAYING) {
            // Update joueur local
            if (this.localPlayer) {
                this.localPlayer.update(deltaTime, this.inputManager, this.gameMap);
            }

            // Update joueur distant depuis réseau
            if (this.remotePlayer && this.networkManager.isConnected()) {
                const remoteData = this.networkManager.getRemotePlayerData();
                this.remotePlayer.updateFromNetwork(remoteData);
            }

            // Host gère les clients
            if (this.gameMode === GameMode.SOLO || this.gameMode === GameMode.MULTI_HOST) {
                this.customerManager.update(deltaTime);
            }

            // Sync réseau
            this.updateNetworkSync(deltaTime);
        }

        if (this.feedbackTimer > 0) {
            this.feedbackTimer -= deltaTime;
        }
    }

    /**
     * Synchronisation réseau
     */
    updateNetworkSync(deltaTime) {
        if (!this.networkManager.isConnected()) return;

        this.networkSyncTimer += deltaTime;
        if (this.networkSyncTimer >= this.networkSyncInterval) {
            this.networkSyncTimer = 0;

            // Envoie l'état du joueur local
            if (this.localPlayer) {
                this.networkManager.sendPlayerState(this.localPlayer.getNetworkData());
            }

            // Host envoie l'état complet du jeu
            if (this.gameMode === GameMode.MULTI_HOST) {
                this.networkManager.sendGameState({
                    score: this.levelManager.score,
                    timeRemaining: this.levelManager.timeRemaining,
                    customersLost: this.levelManager.customersLost,
                    customers: this.customerManager.getCustomersData()
                });
            }
        }
    }

    /**
     * Reçoit l'état du jeu depuis l'host (client)
     */
    handleGameStateFromHost(data) {
        if (this.gameMode !== GameMode.MULTI_CLIENT) return;

        this.levelManager.score = data.score;
        this.levelManager.timeRemaining = data.timeRemaining;
        this.levelManager.customersLost = data.customersLost;

        // Sync customers
        if (data.customers) {
            this.customerManager.updateFromNetwork(data.customers);
        }
    }

    /**
     * Rendu du jeu
     */
    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        switch (this.levelManager.state) {
            case LevelState.MENU:
                this.renderMenuState();
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
     * Rendu des différents états du menu
     */
    renderMenuState() {
        switch (this.menuState) {
            case MenuState.MAIN:
                this.renderMenu();
                break;
            case MenuState.MULTI_MENU:
                this.renderMultiMenu();
                break;
            case MenuState.LOBBY_HOST:
                this.renderLobbyHost();
                break;
            case MenuState.LOBBY_JOIN:
                this.renderLobbyJoin();
                break;
            case MenuState.HIGH_SCORES:
                this.renderHighScores();
                break;
        }
    }

    /**
     * Rendu du menu principal
     */
    renderMenu() {
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
        const options = [
            { label: '🎮 SOLO', color: '#4caf50' },
            { label: '👥 MULTIJOUEUR', color: '#2196f3' },
            { label: '🏆 HIGH SCORES', color: '#9c27b0' },
            { label: '💀 SOLO DIFFICILE', color: '#f44336' }
        ];

        const startY = 180;
        const spacing = 55;

        options.forEach((opt, index) => {
            const y = startY + index * spacing;
            const isSelected = index === this.selectedOption;

            this.ctx.fillStyle = isSelected ? opt.color : 'rgba(255,255,255,0.1)';
            this.ctx.beginPath();
            this.ctx.roundRect(this.width / 2 - 140, y - 20, 280, 40, 10);
            this.ctx.fill();

            this.ctx.fillStyle = isSelected ? '#fff' : '#888';
            this.ctx.font = '11px "Press Start 2P", monospace';
            this.ctx.fillText(opt.label, this.width / 2, y);

            if (isSelected) {
                this.ctx.fillText('▶', this.width / 2 - 125, y);
                this.ctx.fillText('◀', this.width / 2 + 125, y);
            }
        });

        // Instructions
        this.ctx.fillStyle = '#666';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.fillText('Z/S naviguer - E sélectionner', this.width / 2, 460);
    }

    /**
     * Rendu du menu multijoueur
     */
    renderMultiMenu() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Titre
        this.ctx.fillStyle = '#2196f3';
        this.ctx.font = '16px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('👥 MULTIJOUEUR', this.width / 2, 80);

        const options = [
            { label: '🏠 CRÉER PARTIE', desc: 'Héberge une session' },
            { label: '🔗 REJOINDRE', desc: 'Entre un code' }
        ];

        const startY = 200;
        const spacing = 80;

        options.forEach((opt, index) => {
            const y = startY + index * spacing;
            const isSelected = index === this.selectedOption;

            this.ctx.fillStyle = isSelected ? '#2196f3' : 'rgba(255,255,255,0.1)';
            this.ctx.beginPath();
            this.ctx.roundRect(this.width / 2 - 140, y - 25, 280, 50, 10);
            this.ctx.fill();

            this.ctx.fillStyle = isSelected ? '#fff' : '#888';
            this.ctx.font = '11px "Press Start 2P", monospace';
            this.ctx.fillText(opt.label, this.width / 2, y - 5);

            this.ctx.font = '8px "Press Start 2P", monospace';
            this.ctx.fillStyle = isSelected ? '#aaa' : '#666';
            this.ctx.fillText(opt.desc, this.width / 2, y + 12);
        });

        this.ctx.fillStyle = '#666';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.fillText('ESC retour', this.width / 2, 460);
    }

    /**
     * Rendu du lobby host
     */
    renderLobbyHost() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = '#4caf50';
        this.ctx.font = '14px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🏠 PARTIE CRÉÉE', this.width / 2, 60);

        // Code de session
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px "Press Start 2P", monospace';
        this.ctx.fillText('Code de session:', this.width / 2, 120);

        // Grand affichage du code
        this.ctx.fillStyle = '#ffd700';
        this.ctx.font = '32px "Press Start 2P", monospace';
        this.ctx.fillText(this.networkManager.sessionCode || '...', this.width / 2, 170);

        // Statut
        this.ctx.font = '10px "Press Start 2P", monospace';
        if (this.networkManager.state === NetworkState.WAITING) {
            this.ctx.fillStyle = '#ff9800';
            this.ctx.fillText('⏳ En attente du joueur 2...', this.width / 2, 230);
        } else if (this.networkManager.state === NetworkState.CONNECTED) {
            this.ctx.fillStyle = '#4caf50';
            this.ctx.fillText('✓ Joueur 2 connecté !', this.width / 2, 230);

            // Sélection difficulté
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '10px "Press Start 2P", monospace';
            this.ctx.fillText('Difficulté (Z/S):', this.width / 2, 280);

            const config = DifficultyConfig[this.difficulties[this.selectedDifficulty]];
            this.ctx.fillStyle = config.color;
            this.ctx.font = '12px "Press Start 2P", monospace';
            this.ctx.fillText(config.name, this.width / 2, 310);

            this.ctx.fillStyle = '#4caf50';
            this.ctx.font = '10px "Press Start 2P", monospace';
            this.ctx.fillText('Appuie sur E pour lancer !', this.width / 2, 370);
        }

        this.ctx.fillStyle = '#666';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.fillText('ESC annuler', this.width / 2, 460);
    }

    /**
     * Rendu du lobby join
     */
    renderLobbyJoin() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = '#2196f3';
        this.ctx.font = '14px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🔗 REJOINDRE', this.width / 2, 60);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '10px "Press Start 2P", monospace';
        this.ctx.fillText('Entre le code de session:', this.width / 2, 140);

        // Zone de saisie
        this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
        this.ctx.beginPath();
        this.ctx.roundRect(this.width / 2 - 120, 170, 240, 60, 10);
        this.ctx.fill();

        this.ctx.strokeStyle = '#2196f3';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Code saisi
        this.ctx.fillStyle = '#ffd700';
        this.ctx.font = '28px "Press Start 2P", monospace';
        const displayCode = this.joinCodeInput.padEnd(6, '_').split('').join(' ');
        this.ctx.fillText(displayCode, this.width / 2, 205);

        // État de connexion
        if (this.networkManager.state === NetworkState.CONNECTING) {
            this.ctx.fillStyle = '#ff9800';
            this.ctx.font = '10px "Press Start 2P", monospace';
            this.ctx.fillText('⏳ Connexion...', this.width / 2, 280);
        } else if (this.networkManager.state === NetworkState.CONNECTED) {
            this.ctx.fillStyle = '#4caf50';
            this.ctx.font = '10px "Press Start 2P", monospace';
            this.ctx.fillText('✓ Connecté ! En attente...', this.width / 2, 280);
        } else if (this.lobbyError) {
            this.ctx.fillStyle = '#f44336';
            this.ctx.font = '8px "Press Start 2P", monospace';
            this.ctx.fillText(this.lobbyError, this.width / 2, 280);
        } else if (this.joinCodeInput.length === 6) {
            this.ctx.fillStyle = '#4caf50';
            this.ctx.font = '10px "Press Start 2P", monospace';
            this.ctx.fillText('Appuie sur E pour rejoindre', this.width / 2, 280);
        }

        this.ctx.fillStyle = '#666';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.fillText('ESC retour | BACKSPACE effacer', this.width / 2, 460);
    }

    /**
     * Rendu des high scores
     */
    renderHighScores() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = '#ffd700';
        this.ctx.font = '18px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🏆 HIGH SCORES 🏆', this.width / 2, 50);

        // Onglets
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
            this.ctx.fillText('Aucun score', this.width / 2, 250);
        } else {
            scores.forEach((entry, index) => {
                const y = startY + index * spacing;
                const medals = ['🥇', '🥈', '🥉', '4.', '5.'];

                this.ctx.fillStyle = index === 0 ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)';
                this.ctx.beginPath();
                this.ctx.roundRect(50, y - 18, this.width - 100, 36, 8);
                this.ctx.fill();

                this.ctx.fillStyle = '#fff';
                this.ctx.font = '14px "Press Start 2P", monospace';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(medals[index], 70, y);

                this.ctx.font = '12px "Press Start 2P", monospace';
                this.ctx.fillText(`${entry.score} pts`, 120, y);

                this.ctx.fillStyle = '#888';
                this.ctx.font = '8px "Press Start 2P", monospace';
                this.ctx.textAlign = 'right';
                this.ctx.fillText(`${entry.customersServed} clients`, this.width - 70, y);
            });
        }

        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#666';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.fillText('Q/D changer - E retour', this.width / 2, 460);
    }

    /**
     * Rendu du jeu
     */
    renderGame() {
        this.gameMap.render(this.ctx);

        if (this.localPlayer) {
            const playerZone = this.gameMap.getPlayerZone(this.localPlayer);
            this.gameMap.renderInteractionHints(this.ctx, playerZone);
        }

        this.customerManager.render(this.ctx);

        // Rendu des joueurs
        if (this.remotePlayer) {
            this.remotePlayer.render(this.ctx);
        }
        if (this.localPlayer) {
            this.localPlayer.render(this.ctx);
        }

        this.renderHUD();

        if (this.localPlayer && this.localPlayer.isHoldingItem() &&
            this.customerManager.isPlayerNearCounter(this.localPlayer)) {
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

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.width, 50);

        // Timer
        this.ctx.fillStyle = this.levelManager.timeRemaining < 30 ? '#f44336' : '#fff';
        this.ctx.font = '12px "Press Start 2P", monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`⏱ ${this.levelManager.getFormattedTime()}`, 15, 18);

        // Score
        this.ctx.fillStyle = '#ffd700';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`${this.levelManager.score} pts`, this.width - 15, 18);

        // Clients perdus
        const lostCount = this.levelManager.customersLost;
        const maxLost = this.levelManager.maxLostCustomers;

        this.ctx.fillStyle = '#f44336';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`💀 ${lostCount}/${maxLost}`, this.width / 2, 12);

        // Indicateurs de vie
        const spacing = 15;
        const startX = this.width / 2 - ((maxLost - 1) * spacing) / 2;

        for (let i = 0; i < maxLost; i++) {
            this.ctx.fillStyle = i < (maxLost - lostCount) ? '#4caf50' : '#333';
            this.ctx.beginPath();
            this.ctx.arc(startX + i * spacing, 26, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Inventaire
        this.renderInventoryHUD();

        // Mode multi
        if (this.gameMode !== GameMode.SOLO) {
            this.ctx.fillStyle = '#2196f3';
            this.ctx.font = '8px "Press Start 2P", monospace';
            this.ctx.textAlign = 'right';
            this.ctx.fillText('👥 MULTI', this.width - 15, 38);
        }
    }

    /**
     * Affiche l'inventaire dans le HUD
     */
    renderInventoryHUD() {
        if (!this.localPlayer) return;

        const startX = 15;
        const y = 38;

        this.ctx.fillStyle = '#888';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('INV:', startX, y);

        for (let i = 0; i < this.localPlayer.maxInventory; i++) {
            const slotX = startX + 45 + i * 28;

            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.beginPath();
            this.ctx.roundRect(slotX, y - 10, 24, 20, 4);
            this.ctx.fill();

            if (i < this.localPlayer.inventory.length) {
                const item = this.localPlayer.inventory[i];
                Item.renderIcon(this.ctx, item.type, slotX + 12, y, 16);
            }
        }

        const speedPercent = Math.round((this.localPlayer.getCurrentSpeed() / this.localPlayer.baseSpeed) * 100);
        this.ctx.fillStyle = speedPercent < 70 ? '#f44336' : '#4caf50';
        this.ctx.font = '8px "Press Start 2P", monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`⚡${speedPercent}%`, startX + 135, y);
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

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '10px "Press Start 2P", monospace';
            this.ctx.fillText('Trop de clients mécontents !', this.width / 2, this.height / 2 - 20);

            this.ctx.font = '12px "Press Start 2P", monospace';
            this.ctx.fillText(`Score Final: ${this.levelManager.score} pts`, this.width / 2, this.height / 2 + 20);
        }

        this.ctx.font = '10px "Press Start 2P", monospace';
        this.ctx.fillText('Appuie sur E pour continuer', this.width / 2, this.height / 2 + 100);
    }

    /**
     * Indicateur de service
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
     * Message de feedback
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
