/**
 * Player - Le personnage contrôlé par le joueur avec inventaire
 * Supporte le mode multijoueur (local et distant)
 */
import { Entity } from './Entity.js';
import { Item } from './Item.js';

// Couleurs des joueurs
export const PlayerColors = {
    1: { body: '#e74c3c', stroke: '#c0392b', name: 'Rouge' },
    2: { body: '#3498db', stroke: '#2980b9', name: 'Bleu' }
};

export class Player extends Entity {
    constructor(x, y, playerIndex = 1) {
        super(x, y, 40, 40);
        this.playerIndex = playerIndex;
        this.baseSpeed = 220;
        this.direction = 'down';

        // Couleur selon l'index
        this.colors = PlayerColors[playerIndex] || PlayerColors[1];

        // Inventaire (jusqu'à 3 items)
        this.inventory = [];
        this.maxInventory = 3;

        // Multiplicateur de vitesse par item porté
        this.speedPenaltyPerItem = 0.25;

        // Animation
        this.animationTime = 0;
        this.bobAmount = 0;

        // Mode réseau
        this.isRemote = false;
    }

    /**
     * Calcule la vitesse actuelle selon l'inventaire
     */
    getCurrentSpeed() {
        const penalty = 1 - (this.inventory.length * this.speedPenaltyPerItem);
        return this.baseSpeed * Math.max(0.4, penalty);
    }

    /**
     * Met à jour la position du joueur selon les inputs (joueur local)
     */
    update(deltaTime, inputManager, gameMap) {
        // Les joueurs distants sont mis à jour via updateFromNetwork
        if (this.isRemote) return;

        let dx = 0;
        let dy = 0;

        // ZQSD movement
        if (inputManager.isKeyPressed('z')) {
            dy = -1;
            this.direction = 'up';
        }
        if (inputManager.isKeyPressed('s')) {
            dy = 1;
            this.direction = 'down';
        }
        if (inputManager.isKeyPressed('q')) {
            dx = -1;
            this.direction = 'left';
        }
        if (inputManager.isKeyPressed('d')) {
            dx = 1;
            this.direction = 'right';
        }

        // Normalise le mouvement diagonal
        if (dx !== 0 && dy !== 0) {
            const factor = 1 / Math.sqrt(2);
            dx *= factor;
            dy *= factor;
        }

        // Vitesse selon l'inventaire
        const speed = this.getCurrentSpeed();

        // Calcule la nouvelle position
        const newX = this.x + dx * speed * deltaTime;
        const newY = this.y + dy * speed * deltaTime;

        // Vérifie les collisions avec la map
        if (gameMap.canMoveTo(newX, this.y, this.width, this.height)) {
            this.x = newX;
        }
        if (gameMap.canMoveTo(this.x, newY, this.width, this.height)) {
            this.y = newY;
        }

        // Animation de marche
        if (dx !== 0 || dy !== 0) {
            this.animationTime += deltaTime * 8;
            this.bobAmount = Math.sin(this.animationTime) * 2;
        } else {
            this.bobAmount = 0;
        }
    }

    /**
     * Met à jour depuis les données réseau (joueur distant)
     */
    updateFromNetwork(data) {
        if (!data) return;

        this.x = data.x;
        this.y = data.y;
        this.direction = data.direction;
        this.bobAmount = data.bobAmount || 0;

        // Reconstruit l'inventaire depuis les types
        if (data.inventoryTypes) {
            this.inventory = data.inventoryTypes.map(type => new Item(type));
        }
    }

    /**
     * Retourne les données pour la synchronisation réseau
     */
    getNetworkData() {
        return {
            x: this.x,
            y: this.y,
            direction: this.direction,
            bobAmount: this.bobAmount,
            inventoryTypes: this.inventory.map(item => item.type)
        };
    }

    /**
     * Ajoute un item à l'inventaire
     */
    pickUp(item) {
        if (this.inventory.length < this.maxInventory) {
            this.inventory.push(item);
            return true;
        }
        return false;
    }

    /**
     * Retire et retourne le dernier item de l'inventaire
     */
    dropItem() {
        if (this.inventory.length > 0) {
            return this.inventory.pop();
        }
        return null;
    }

    /**
     * Retire et retourne un item spécifique de l'inventaire
     */
    dropItemOfType(itemType) {
        const index = this.inventory.findIndex(item => item.type === itemType);
        if (index !== -1) {
            return this.inventory.splice(index, 1)[0];
        }
        return null;
    }

    /**
     * Vérifie si l'inventaire contient un type d'item
     */
    hasItemOfType(itemType) {
        return this.inventory.some(item => item.type === itemType);
    }

    /**
     * Compte les items d'un type
     */
    countItemsOfType(itemType) {
        return this.inventory.filter(item => item.type === itemType).length;
    }

    /**
     * Vérifie si le joueur tient au moins un item
     */
    isHoldingItem() {
        return this.inventory.length > 0;
    }

    /**
     * Vérifie si l'inventaire est plein
     */
    isInventoryFull() {
        return this.inventory.length >= this.maxInventory;
    }

    /**
     * Vide l'inventaire
     */
    clearInventory() {
        this.inventory = [];
    }

    /**
     * Dessine le joueur
     */
    render(ctx) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2 + this.bobAmount;

        // Ombre (plus grande si on porte des objets)
        const shadowSize = 15 + this.inventory.length * 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(cx, this.y + this.height - 5, shadowSize, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Corps (tablier) avec couleur du joueur
        ctx.fillStyle = this.colors.body;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 5, 14, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = this.colors.stroke;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Tablier
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 8, cy, 16, 14);
        ctx.strokeStyle = '#ddd';
        ctx.strokeRect(cx - 8, cy, 16, 14);

        // Numéro du joueur sur le tablier
        ctx.fillStyle = this.colors.body;
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.playerIndex.toString(), cx, cy + 7);

        // Tête
        ctx.fillStyle = '#fdbf6f';
        ctx.beginPath();
        ctx.arc(cx, cy - 10, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e6a23c';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Toque de chef (avec couleur du joueur)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 22, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - 8, cy - 28, 16, 10);

        // Bandeau coloré sur la toque
        ctx.fillStyle = this.colors.body;
        ctx.fillRect(cx - 8, cy - 23, 16, 3);

        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 22, 10, 6, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Yeux selon la direction
        ctx.fillStyle = '#333';
        const eyeOffsetX = this.direction === 'left' ? -3 : this.direction === 'right' ? 3 : 0;
        const eyeOffsetY = this.direction === 'up' ? -2 : this.direction === 'down' ? 2 : 0;

        ctx.beginPath();
        ctx.arc(cx - 4 + eyeOffsetX, cy - 10 + eyeOffsetY, 2, 0, Math.PI * 2);
        ctx.arc(cx + 4 + eyeOffsetX, cy - 10 + eyeOffsetY, 2, 0, Math.PI * 2);
        ctx.fill();

        // Dessine les items portés (empilés au-dessus de la tête)
        this.renderInventory(ctx, cx, cy);
    }

    /**
     * Dessine les items de l'inventaire
     */
    renderInventory(ctx, cx, cy) {
        const startY = cy - 50;
        const spacing = 22;

        this.inventory.forEach((item, index) => {
            item.x = cx - 16;
            item.y = startY - index * spacing;
            item.render(ctx);
        });
    }
}
