/**
 * Item - Représente un item portable (kebab, boisson)
 */
import { Entity } from './Entity.js';

export const ItemType = {
    KEBAB: 'kebab',
    DRINK: 'drink'
};

export class Item extends Entity {
    constructor(type, x = 0, y = 0) {
        super(x, y, 32, 32);
        this.type = type;
    }

    /**
     * Dessine l'item
     */
    render(ctx) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        if (this.type === ItemType.KEBAB) {
            this.renderKebab(ctx, centerX, centerY);
        } else if (this.type === ItemType.DRINK) {
            this.renderDrink(ctx, centerX, centerY);
        }
    }

    /**
     * Dessine le sprite kebab
     */
    renderKebab(ctx, cx, cy) {
        // Pain du kebab (forme ovale)
        ctx.fillStyle = '#d4a574';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8b6914';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Garniture - salade
        ctx.fillStyle = '#4caf50';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 2, 10, 4, 0, 0, Math.PI);
        ctx.fill();

        // Viande
        ctx.fillStyle = '#8d4a2c';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 2, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sauce
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 3, cy, 2, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Dessine le sprite boisson
     */
    renderDrink(ctx, cx, cy) {
        // Verre
        ctx.fillStyle = '#87ceeb';
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 12);
        ctx.lineTo(cx + 8, cy - 12);
        ctx.lineTo(cx + 6, cy + 10);
        ctx.lineTo(cx - 6, cy + 10);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Contour
        ctx.strokeStyle = '#4a90a4';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Liquide
        ctx.fillStyle = '#ff6b35';
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy - 6);
        ctx.lineTo(cx + 7, cy - 6);
        ctx.lineTo(cx + 6, cy + 8);
        ctx.lineTo(cx - 6, cy + 8);
        ctx.closePath();
        ctx.fill();

        // Paille
        ctx.strokeStyle = '#ff4081';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + 3, cy - 16);
        ctx.lineTo(cx + 2, cy);
        ctx.stroke();
    }

    /**
     * Dessine l'icône de l'item (pour les bulles de pensée)
     */
    static renderIcon(ctx, type, x, y, size = 24) {
        const item = new Item(type, x - size / 2, y - size / 2);
        item.width = size;
        item.height = size;

        ctx.save();
        const scale = size / 32;
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.translate(-x, -y);

        if (type === ItemType.KEBAB) {
            item.renderKebab(ctx, x, y);
        } else {
            item.renderDrink(ctx, x, y);
        }

        ctx.restore();
    }
}
