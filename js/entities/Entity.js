/**
 * Entity - Classe de base pour toutes les entités du jeu
 */
export class Entity {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = true;
    }

    /**
     * Retourne le rectangle de collision
     */
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    /**
     * Vérifie la collision avec une autre entité
     */
    collidesWith(other) {
        const a = this.getBounds();
        const b = other.getBounds();

        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    /**
     * Vérifie si un point est dans l'entité
     */
    containsPoint(px, py) {
        return (
            px >= this.x &&
            px <= this.x + this.width &&
            py >= this.y &&
            py <= this.y + this.height
        );
    }

    /**
     * Retourne le centre de l'entité
     */
    getCenter() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    /**
     * Met à jour l'entité (à surcharger)
     */
    update(deltaTime) { }

    /**
     * Dessine l'entité (à surcharger)
     */
    render(ctx) { }
}
