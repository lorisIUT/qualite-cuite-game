/**
 * LevelManager - Gestion des niveaux et de la difficulté (Règles mises à jour)
 */
export const Difficulty = {
    EASY: 'easy',
    MEDIUM: 'medium',
    HARD: 'hard'
};

export const DifficultyConfig = {
    [Difficulty.EASY]: {
        name: 'Facile',
        maxCustomers: 2,
        customerSpawnDelay: 4000,
        customerPatience: 25,
        color: '#4caf50'
    },
    [Difficulty.MEDIUM]: {
        name: 'Moyen',
        maxCustomers: 3,
        customerSpawnDelay: 3000,
        customerPatience: 20,
        color: '#ff9800'
    },
    [Difficulty.HARD]: {
        name: 'Difficile',
        maxCustomers: 4,
        customerSpawnDelay: 2000,
        customerPatience: 15,
        color: '#f44336'
    }
};

export const LevelState = {
    MENU: 'menu',
    PLAYING: 'playing',
    WON: 'won', // Fin du temps (réussite)
    LOST: 'lost' // Trop de clients perdus
};

export class LevelManager {
    constructor() {
        this.state = LevelState.MENU;
        this.difficulty = null;
        this.config = null;

        // Timer fixe de 60s
        this.levelDuration = 60;
        this.timeRemaining = 0;

        // Score
        this.score = 0;

        // Condition de défaite
        this.customersLost = 0;
        this.maxLostCustomers = 5;

        // Callbacks
        this.onStateChange = null;
    }

    /**
     * Démarre un niveau
     */
    startLevel(difficulty) {
        this.difficulty = difficulty;
        this.config = DifficultyConfig[difficulty];
        this.timeRemaining = this.levelDuration;
        this.score = 0;
        this.customersLost = 0;
        this.state = LevelState.PLAYING;

        if (this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    /**
     * Met à jour le timer et les conditions de victoire/défaite
     */
    update(deltaTime) {
        if (this.state !== LevelState.PLAYING) return;

        this.timeRemaining -= deltaTime;

        // Vérifie la défaite (trop de clients perdus)
        if (this.customersLost >= this.maxLostCustomers) {
            this.state = LevelState.LOST;
            if (this.onStateChange) {
                this.onStateChange(this.state);
            }
            return;
        }

        // Vérifie la fin du temps (victoire/fin de partie)
        if (this.timeRemaining <= 0) {
            this.timeRemaining = 0;
            this.state = LevelState.WON; // On considère que finir le temps est une "victoire" (score final)
            if (this.onStateChange) {
                this.onStateChange(this.state);
            }
        }
    }

    /**
     * Ajoute des points
     */
    addScore(points = 1) {
        this.score += points;
    }

    /**
     * Enregistre un client perdu
     */
    addLostCustomer() {
        this.customersLost++;
    }

    /**
     * Retourne au menu
     */
    returnToMenu() {
        this.state = LevelState.MENU;
        this.difficulty = null;
        this.config = null;
        this.score = 0;
        this.timeRemaining = 0;
        this.customersLost = 0;

        if (this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    /**
     * Formate le temps restant en MM:SS
     */
    getFormattedTime() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = Math.floor(this.timeRemaining % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Retourne la progression du temps (pour barre de temps si besoin)
     */
    getTimeProgress() {
        return this.timeRemaining / this.levelDuration;
    }

    /**
     * Retourne si le jeu est en cours
     */
    isPlaying() {
        return this.state === LevelState.PLAYING;
    }
}
