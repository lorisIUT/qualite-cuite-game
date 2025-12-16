/**
 * ScoreManager - Gestion des scores et high scores
 */
export class ScoreManager {
    constructor() {
        this.storageKey = 'qualiteCuiteHighScores';
        this.maxHighScores = 5;
    }

    /**
     * Récupère les high scores depuis localStorage
     */
    getHighScores() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error('Erreur lecture high scores:', e);
        }

        // Scores par défaut
        return {
            easy: [],
            medium: [],
            hard: []
        };
    }

    /**
     * Sauvegarde un nouveau score
     */
    saveScore(difficulty, score, customersServed, timeRemaining) {
        const highScores = this.getHighScores();

        const entry = {
            score,
            customersServed,
            timeRemaining,
            date: new Date().toISOString()
        };

        // Ajoute le score
        if (!highScores[difficulty]) {
            highScores[difficulty] = [];
        }
        highScores[difficulty].push(entry);

        // Trie par score décroissant
        highScores[difficulty].sort((a, b) => b.score - a.score);

        // Garde seulement les top scores
        highScores[difficulty] = highScores[difficulty].slice(0, this.maxHighScores);

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(highScores));
        } catch (e) {
            console.error('Erreur sauvegarde high scores:', e);
        }

        return this.getRank(difficulty, score);
    }

    /**
     * Retourne le rang d'un score
     */
    getRank(difficulty, score) {
        const highScores = this.getHighScores();
        const scores = highScores[difficulty] || [];

        for (let i = 0; i < scores.length; i++) {
            if (scores[i].score === score) {
                return i + 1;
            }
        }

        return -1;
    }

    /**
     * Vérifie si un score est un nouveau record
     */
    isNewHighScore(difficulty, score) {
        const highScores = this.getHighScores();
        const scores = highScores[difficulty] || [];

        if (scores.length < this.maxHighScores) {
            return true;
        }

        return score > scores[scores.length - 1].score;
    }

    /**
     * Retourne le meilleur score pour une difficulté
     */
    getBestScore(difficulty) {
        const highScores = this.getHighScores();
        const scores = highScores[difficulty] || [];

        return scores.length > 0 ? scores[0].score : 0;
    }

    /**
     * Efface tous les scores
     */
    clearScores() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {
            console.error('Erreur suppression high scores:', e);
        }
    }
}
