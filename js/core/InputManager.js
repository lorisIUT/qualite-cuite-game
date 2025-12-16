/**
 * InputManager - Gestion centralisée des inputs clavier
 * Permet d'ajouter facilement de nouvelles touches
 */
export class InputManager {
    constructor() {
        this.keys = {};
        this.keyDownCallbacks = new Map();
        
        this.setupListeners();
    }
    
    setupListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            
            // Évite la répétition automatique
            if (!this.keys[key]) {
                this.keys[key] = true;
                
                // Déclenche les callbacks enregistrés
                if (this.keyDownCallbacks.has(key)) {
                    this.keyDownCallbacks.get(key).forEach(cb => cb());
                }
            }
            
            // Empêche le scroll avec les touches de jeu
            if (['z', 'q', 's', 'd', 'e', ' '].includes(key)) {
                e.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // Réinitialise les touches si la fenêtre perd le focus
        window.addEventListener('blur', () => {
            this.keys = {};
        });
    }
    
    /**
     * Vérifie si une touche est enfoncée
     */
    isKeyPressed(key) {
        return this.keys[key.toLowerCase()] === true;
    }
    
    /**
     * Enregistre un callback déclenché une fois au moment où la touche est pressée
     */
    onKeyDown(key, callback) {
        const k = key.toLowerCase();
        if (!this.keyDownCallbacks.has(k)) {
            this.keyDownCallbacks.set(k, []);
        }
        this.keyDownCallbacks.get(k).push(callback);
    }
    
    /**
     * Supprime un callback
     */
    removeKeyDown(key, callback) {
        const k = key.toLowerCase();
        if (this.keyDownCallbacks.has(k)) {
            const callbacks = this.keyDownCallbacks.get(k);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
}
