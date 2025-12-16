/**
 * GameMap - Définition de la carte du jeu
 */
import { Zone, ZoneType } from './Zone.js';
import { Item, ItemType } from '../entities/Item.js';

export class GameMap {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.zones = [];
        this.walls = [];

        this.setupZones();
    }

    /**
     * Configure les zones du jeu
     */
    setupZones() {
        const counterHeight = 80;
        const counterY = this.height - counterHeight - 20;
        const kitchenHeight = counterY - 20;

        // Zone cuisine (où le joueur peut se déplacer)
        this.kitchenZone = new Zone(20, 20, this.width - 40, kitchenHeight - 20, ZoneType.KITCHEN, {
            color: '#2d2d2d',
            borderColor: '#444',
            interactive: false
        });
        this.zones.push(this.kitchenZone);

        // Station Kebabs
        this.kebabStation = new Zone(40, 60, 120, 100, ZoneType.KEBAB_STATION, {
            label: 'KEBABS',
            color: '#8d4a2c',
            borderColor: '#6d3a1c',
            interactive: true
        });
        this.zones.push(this.kebabStation);

        // Station Boissons
        this.drinkStation = new Zone(this.width - 160, 60, 120, 100, ZoneType.DRINK_STATION, {
            label: 'BOISSONS',
            color: '#1565c0',
            borderColor: '#0d47a1',
            interactive: true
        });
        this.zones.push(this.drinkStation);

        // Comptoir
        this.counterZone = new Zone(20, counterY, this.width - 40, 20, ZoneType.COUNTER, {
            color: '#5d4037',
            borderColor: '#3e2723',
            interactive: false
        });
        this.zones.push(this.counterZone);

        // Zone client
        this.customerSpot = new Zone(
            this.width / 2 - 40,
            counterY + 30,
            80,
            70,
            ZoneType.CUSTOMER_SPOT,
            {
                color: '#1a1a2e',
                borderColor: '#0f0f1e',
                interactive: true
            }
        );
        this.zones.push(this.customerSpot);

        // Murs (limites de déplacement)
        this.playerBounds = {
            minX: 25,
            maxX: this.width - 65,
            minY: 25,
            maxY: counterY - 45
        };
    }

    /**
     * Vérifie si le joueur peut se déplacer à une position
     */
    canMoveTo(x, y, width, height) {
        return (
            x >= this.playerBounds.minX &&
            x + width <= this.playerBounds.maxX + width &&
            y >= this.playerBounds.minY &&
            y + height <= this.playerBounds.maxY + height
        );
    }

    /**
     * Récupère la zone où se trouve le joueur
     */
    getPlayerZone(player) {
        const interactiveZones = [this.kebabStation, this.drinkStation];

        for (const zone of interactiveZones) {
            if (zone.containsEntity(player)) {
                return zone;
            }
        }

        // Vérifie si proche du comptoir
        const playerCenter = player.getCenter();
        if (Math.abs(playerCenter.y - this.counterZone.y) < 50) {
            return this.counterZone;
        }

        return null;
    }

    /**
     * Dessine la map
     */
    render(ctx) {
        // Fond
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.width, this.height);

        // Sol de la cuisine (damier)
        this.renderKitchenFloor(ctx);

        // Dessine les zones
        for (const zone of this.zones) {
            zone.render(ctx);
        }

        // Décorations
        this.renderDecorations(ctx);
    }

    /**
     * Dessine le sol en damier
     */
    renderKitchenFloor(ctx) {
        const tileSize = 40;
        const startX = this.kitchenZone.x;
        const startY = this.kitchenZone.y;
        const endX = startX + this.kitchenZone.width;
        const endY = startY + this.kitchenZone.height;

        for (let x = startX; x < endX; x += tileSize) {
            for (let y = startY; y < endY; y += tileSize) {
                const isEven = ((x - startX) / tileSize + (y - startY) / tileSize) % 2 === 0;
                ctx.fillStyle = isEven ? '#2d2d2d' : '#353535';
                ctx.fillRect(x, y, tileSize, tileSize);
            }
        }
    }

    /**
     * Dessine les décorations
     */
    renderDecorations(ctx) {
        // Icône kebab sur la station
        Item.renderIcon(ctx, ItemType.KEBAB,
            this.kebabStation.x + this.kebabStation.width / 2,
            this.kebabStation.y + this.kebabStation.height - 25,
            40
        );

        // Icône boisson sur la station
        Item.renderIcon(ctx, ItemType.DRINK,
            this.drinkStation.x + this.drinkStation.width / 2,
            this.drinkStation.y + this.drinkStation.height - 25,
            40
        );

        // Indicateur client
        ctx.fillStyle = '#fff';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CLIENT', this.customerSpot.x + this.customerSpot.width / 2, this.customerSpot.y + 12);
    }

    /**
     * Dessine les indicateurs d'interaction
     */
    renderInteractionHints(ctx, playerZone) {
        // Station kebabs
        if (this.kebabStation === playerZone) {
            this.kebabStation.renderInteractionHint(ctx, true);
        }

        // Station boissons  
        if (this.drinkStation === playerZone) {
            this.drinkStation.renderInteractionHint(ctx, true);
        }
    }
}
