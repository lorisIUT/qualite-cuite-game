/**
 * Zone - Une zone interactive sur la map
 */
export const ZoneType = {
    KITCHEN: 'kitchen',
    COUNTER: 'counter',
    KEBAB_STATION: 'kebab_station',
    DRINK_STATION: 'drink_station',
    CUSTOMER_SPOT: 'customer_spot'
};

export class Zone {
    constructor(x, y, width, height, type, options = {}) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.label = options.label || '';
        this.color = options.color || '#333';
        this.borderColor = options.borderColor || '#000';
        this.interactive = options.interactive !== false;
    }

    /**
     * Vérifie si un point est dans la zone
     */
    contains(px, py) {
        return (
            px >= this.x &&
            px <= this.x + this.width &&
            py >= this.y &&
            py <= this.y + this.height
        );
    }

    /**
     * Vérifie si une entité est dans la zone
     */
    containsEntity(entity) {
        const center = entity.getCenter();
        return this.contains(center.x, center.y);
    }

    /**
     * Vérifie si une entité touche la zone
     */
    intersectsEntity(entity) {
        return (
            entity.x < this.x + this.width &&
            entity.x + entity.width > this.x &&
            entity.y < this.y + this.height &&
            entity.y + entity.height > this.y
        );
    }

    /**
     * Dessine la zone
     */
    render(ctx) {
        // Fond
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Bordure
        ctx.strokeStyle = this.borderColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // Label
        if (this.label) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Ombre du texte
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            ctx.fillText(this.label, this.x + this.width / 2, this.y + this.height / 2);

            ctx.shadowColor = 'transparent';
        }
    }

    /**
     * Dessine l'indicateur d'interaction
     */
    renderInteractionHint(ctx, active = false) {
        if (!this.interactive) return;

        const cx = this.x + this.width / 2;
        const cy = this.y - 15;

        // Cercle avec E
        ctx.fillStyle = active ? '#4caf50' : 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = active ? '#2e7d32' : '#666';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = active ? '#fff' : '#333';
        ctx.font = 'bold 10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('E', cx, cy);
    }
}
