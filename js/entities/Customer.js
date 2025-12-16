/**
 * Customer - Un client qui attend sa commande avec patience limitée
 */
import { Entity } from './Entity.js';
import { Item, ItemType } from './Item.js';

export class Customer extends Entity {
    constructor(x, y, order, basePatience = 15) {
        super(x, y, 50, 60);

        // Commande multi-items: { kebab: 0-2, drink: 0-2 }
        this.order = order;
        this.originalOrder = { ...order };
        this.satisfied = false;
        this.angry = false; // Client parti sans être servi

        // Patience dynamique: +5s par item supplémentaire au-delà du premier
        const totalItems = order.kebab + order.drink;
        const extraTime = Math.max(0, totalItems - 1) * 5;
        this.maxPatience = basePatience + extraTime;
        this.patience = this.maxPatience;

        // Animation
        this.animationTime = Math.random() * Math.PI * 2;
        this.bubbleOffset = 0;
    }

    /**
     * Génère une commande aléatoire
     */
    static generateRandomOrder() {
        // Possibilités:
        // - 1 kebab, 1 boisson, 2 kebabs, 2 boissons
        // - 1 kebab + 1 boisson, 2 kebabs + 1 boisson, etc.
        const choices = [
            { kebab: 1, drink: 0 },
            { kebab: 0, drink: 1 },
            { kebab: 2, drink: 0 },
            { kebab: 0, drink: 2 },
            { kebab: 1, drink: 1 },
            { kebab: 2, drink: 1 },
            { kebab: 1, drink: 2 },
        ];

        // Pondération: commandes simples plus fréquentes
        const weights = [3, 3, 2, 2, 2, 1, 1];
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < choices.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return { ...choices[i] };
            }
        }

        return { kebab: 1, drink: 0 };
    }

    /**
     * Met à jour le client
     */
    update(deltaTime) {
        this.animationTime += deltaTime * 2;
        this.bubbleOffset = Math.sin(this.animationTime) * 3;

        // Diminue la patience
        if (!this.satisfied && !this.angry) {
            this.patience -= deltaTime;
            if (this.patience <= 0) {
                this.patience = 0;
                this.angry = true;
            }
        }
    }

    /**
     * Retourne le ratio de patience (0-1)
     */
    getPatienceRatio() {
        return this.patience / this.maxPatience;
    }

    /**
     * Vérifie si le client a encore besoin de cet item
     */
    needsItem(itemType) {
        if (itemType === ItemType.KEBAB) {
            return this.order.kebab > 0;
        } else if (itemType === ItemType.DRINK) {
            return this.order.drink > 0;
        }
        return false;
    }

    /**
     * Livre un item au client
     */
    deliverItem(item) {
        if (!item) return false;

        if (item.type === ItemType.KEBAB && this.order.kebab > 0) {
            this.order.kebab--;
            this.checkIfSatisfied();
            return true;
        } else if (item.type === ItemType.DRINK && this.order.drink > 0) {
            this.order.drink--;
            this.checkIfSatisfied();
            return true;
        }

        return false;
    }

    /**
     * Vérifie si la commande est complète
     */
    checkIfSatisfied() {
        if (this.order.kebab === 0 && this.order.drink === 0) {
            this.satisfied = true;
        }
    }

    /**
     * Retourne le nombre total d'items dans la commande originale
     */
    getTotalOrderItems() {
        return this.originalOrder.kebab + this.originalOrder.drink;
    }

    /**
     * Retourne le nombre d'items restants
     */
    getRemainingItems() {
        return this.order.kebab + this.order.drink;
    }

    /**
     * Dessine le client
     */
    render(ctx) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        if (this.satisfied) {
            this.renderSatisfied(ctx, cx, cy);
        } else if (this.angry) {
            this.renderAngry(ctx, cx, cy);
        } else {
            this.renderWaiting(ctx, cx, cy);
        }
    }

    /**
     * Dessine un client satisfait
     */
    renderSatisfied(ctx, cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1.1, 1.1);
        ctx.translate(-cx, -cy);

        this.renderBody(ctx, cx, cy, '#27ae60');

        // Sourire
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 6, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // Étoiles
        ctx.fillStyle = '#ffd700';
        this.renderStar(ctx, cx - 20, cy - 25, 6);
        this.renderStar(ctx, cx + 20, cy - 25, 6);

        ctx.restore();
    }

    /**
     * Dessine un client en colère (parti)
     */
    renderAngry(ctx, cx, cy) {
        ctx.globalAlpha = 0.6;
        this.renderBody(ctx, cx, cy, '#e74c3c');

        // Sourcils froncés
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 15);
        ctx.lineTo(cx - 3, cy - 12);
        ctx.moveTo(cx + 8, cy - 15);
        ctx.lineTo(cx + 3, cy - 12);
        ctx.stroke();

        // Bouche mécontente
        ctx.beginPath();
        ctx.arc(cx, cy + 10, 5, Math.PI + 0.3, -0.3);
        ctx.stroke();

        ctx.globalAlpha = 1;
    }

    /**
     * Dessine un client en attente
     */
    renderWaiting(ctx, cx, cy) {
        // Couleur selon la patience
        const ratio = this.getPatienceRatio();
        let bodyColor;
        if (ratio > 0.5) {
            bodyColor = '#3498db'; // Bleu - content
        } else if (ratio > 0.25) {
            bodyColor = '#f39c12'; // Orange - impatient
        } else {
            bodyColor = '#e74c3c'; // Rouge - très impatient
        }

        this.renderBody(ctx, cx, cy, bodyColor);

        // Expression selon patience
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        if (ratio > 0.5) {
            // Neutre
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy + 5);
            ctx.lineTo(cx + 5, cy + 5);
            ctx.stroke();
        } else {
            // Mécontent
            ctx.beginPath();
            ctx.arc(cx, cy + 10, 4, Math.PI + 0.2, -0.2);
            ctx.stroke();
        }

        // Barre de patience
        this.renderPatienceBar(ctx, cx);

        // Bulle de commande
        this.renderThoughtBubble(ctx, cx, cy);
    }

    /**
     * Dessine la barre de patience
     */
    renderPatienceBar(ctx, cx) {
        const barWidth = 40;
        const barHeight = 6;
        const barX = cx - barWidth / 2;
        const barY = this.y - 10;
        const ratio = this.getPatienceRatio();

        // Fond
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2, 3);
        ctx.fill();

        // Barre de patience
        let barColor;
        if (ratio > 0.5) {
            barColor = '#4caf50';
        } else if (ratio > 0.25) {
            barColor = '#ff9800';
        } else {
            barColor = '#f44336';
        }

        ctx.fillStyle = barColor;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth * ratio, barHeight, 2);
        ctx.fill();
    }

    /**
     * Dessine le corps du client
     */
    renderBody(ctx, cx, cy, shirtColor) {
        // Ombre
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(cx, this.y + this.height - 3, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Corps
        ctx.fillStyle = shirtColor;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 10, 16, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.darkenColor(shirtColor);
        ctx.lineWidth = 2;
        ctx.stroke();

        // Tête
        ctx.fillStyle = '#fdbf6f';
        ctx.beginPath();
        ctx.arc(cx, cy - 10, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e6a23c';
        ctx.stroke();

        // Yeux
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(cx - 5, cy - 12, 2, 0, Math.PI * 2);
        ctx.arc(cx + 5, cy - 12, 2, 0, Math.PI * 2);
        ctx.fill();

        // Cheveux
        ctx.fillStyle = '#5d4037';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 20, 12, 6, 0, Math.PI, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Dessine la bulle de pensée avec les items demandés
     */
    renderThoughtBubble(ctx, cx, cy) {
        const items = [];
        for (let i = 0; i < this.order.kebab; i++) items.push(ItemType.KEBAB);
        for (let i = 0; i < this.order.drink; i++) items.push(ItemType.DRINK);

        if (items.length === 0) return;

        // Calcule la taille de la bulle
        const itemSize = 20;
        const spacing = 5;
        const bubbleWidth = items.length * (itemSize + spacing) + 10;
        const bubbleHeight = 30;
        const bubbleX = cx + 15;
        const bubbleY = cy - 40 + this.bubbleOffset;

        // Petits cercles vers la bulle
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx + 8, cy - 18, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 12, cy - 26, 5, 0, Math.PI * 2);
        ctx.fill();

        // Bulle principale (rectangle arrondi)
        ctx.beginPath();
        ctx.roundRect(bubbleX - bubbleWidth / 2, bubbleY - bubbleHeight / 2, bubbleWidth, bubbleHeight, 10);
        ctx.fill();
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dessine les items
        let startX = bubbleX - (items.length - 1) * (itemSize + spacing) / 2;
        items.forEach((type, i) => {
            const itemX = startX + i * (itemSize + spacing);
            Item.renderIcon(ctx, type, itemX, bubbleY, itemSize);
        });
    }

    /**
     * Dessine une étoile
     */
    renderStar(ctx, x, y, size) {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const px = x + Math.cos(angle) * size;
            const py = y + Math.sin(angle) * size;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    /**
     * Assombrit une couleur
     */
    darkenColor(color) {
        const darken = {
            '#3498db': '#2980b9',
            '#27ae60': '#1e8449',
            '#e74c3c': '#c0392b',
            '#f39c12': '#d68910'
        };
        return darken[color] || color;
    }
}
