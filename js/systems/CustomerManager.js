/**
 * CustomerManager - Gestion des clients (multi-clients avec patience)
 */
import { Customer } from '../entities/Customer.js';

export class CustomerManager {
    constructor(gameMap) {
        this.gameMap = gameMap;
        this.customers = [];
        this.maxCustomers = 2;

        // Positions des clients au comptoir
        this.customerPositions = this.calculatePositions();

        // Spawn timing
        this.spawnDelay = 3000;
        this.timeSinceLastSpawn = 0;
        this.autoSpawn = false;

        // Patience par difficulté
        this.customerPatience = 15;

        // Stats
        this.customersServed = 0;
        this.customersLost = 0;

        // Callback
        this.onCustomerAngry = null;
    }

    /**
     * Calcule les positions des clients au comptoir
     */
    calculatePositions() {
        const spot = this.gameMap.customerSpot;
        const positions = [];
        const spacing = 65;
        const startX = spot.x - 70;

        for (let i = 0; i < 4; i++) {
            positions.push({
                x: startX + i * spacing,
                y: spot.y + 5,
                occupied: false
            });
        }

        return positions;
    }

    /**
     * Configure le manager pour un niveau
     */
    configure(maxCustomers, spawnDelay, patience) {
        this.maxCustomers = maxCustomers;
        this.spawnDelay = spawnDelay;
        this.customerPatience = patience;
        this.autoSpawn = true;
        this.timeSinceLastSpawn = this.spawnDelay;
    }

    /**
     * Réinitialise le manager
     */
    reset() {
        this.customers = [];
        this.customerPositions.forEach(pos => pos.occupied = false);
        this.timeSinceLastSpawn = 0;
        this.autoSpawn = false;
        this.customersServed = 0;
        this.customersLost = 0;
    }

    /**
     * Trouve une position libre
     */
    findFreePosition() {
        for (let i = 0; i < this.maxCustomers && i < this.customerPositions.length; i++) {
            if (!this.customerPositions[i].occupied) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Spawn un nouveau client avec une commande aléatoire
     */
    spawnCustomer() {
        const posIndex = this.findFreePosition();
        if (posIndex === -1) return null;

        const pos = this.customerPositions[posIndex];
        pos.occupied = true;

        const order = Customer.generateRandomOrder();
        const customer = new Customer(pos.x, pos.y, order, this.customerPatience);
        customer.positionIndex = posIndex;
        this.customers.push(customer);

        return customer;
    }

    /**
     * Trouve le client le plus proche qui a besoin de l'item
     */
    findNearestCustomerNeedingItem(player, itemType) {
        if (this.customers.length === 0) return null;

        const playerCenter = player.getCenter();
        let nearest = null;
        let minDist = Infinity;

        for (const customer of this.customers) {
            if (customer.satisfied || customer.angry) continue;
            if (!customer.needsItem(itemType)) continue;

            const cx = customer.x + customer.width / 2;
            const cy = customer.y + customer.height / 2;
            const dist = Math.hypot(playerCenter.x - cx, playerCenter.y - cy);

            if (dist < minDist) {
                minDist = dist;
                nearest = customer;
            }
        }

        return nearest;
    }

    /**
     * Essaie de servir le client le plus proche
     */
    tryServeCustomer(player, item) {
        if (!item) return { success: false, points: 0 };

        const customer = this.findNearestCustomerNeedingItem(player, item.type);
        if (!customer) return { success: false, points: 0, wrongOrder: true };

        const accepted = customer.deliverItem(item);
        if (accepted) {
            // Points bonus si commande complétée
            const completed = customer.satisfied;
            const points = completed ? customer.getTotalOrderItems() : 1;

            if (completed) {
                this.customersServed++;
                const posIndex = customer.positionIndex;

                // Retire le client après animation
                setTimeout(() => {
                    this.removeCustomer(customer);
                    this.customerPositions[posIndex].occupied = false;
                }, 800);
            }

            return {
                success: true,
                correct: true,
                points,
                completed,
                orderSize: customer.getTotalOrderItems()
            };
        }

        return { success: false, points: 0 };
    }

    /**
     * Retire un client
     */
    removeCustomer(customer) {
        const index = this.customers.indexOf(customer);
        if (index > -1) {
            this.customers.splice(index, 1);
        }
    }

    /**
     * Met à jour les clients
     */
    update(deltaTime) {
        // Auto-spawn
        if (this.autoSpawn) {
            this.timeSinceLastSpawn += deltaTime * 1000;

            if (this.timeSinceLastSpawn >= this.spawnDelay) {
                const waitingCount = this.customers.filter(c => !c.satisfied && !c.angry).length;
                if (waitingCount < this.maxCustomers) {
                    this.spawnCustomer();
                }
                this.timeSinceLastSpawn = 0;
            }
        }

        // Update clients et gestion des clients partis
        for (let i = this.customers.length - 1; i >= 0; i--) {
            const customer = this.customers[i];
            const wasAngry = customer.angry;

            customer.update(deltaTime);

            // Client vient de partir en colère
            if (customer.angry && !wasAngry) {
                this.customersLost++;
                const posIndex = customer.positionIndex;

                // Notifie le jeu
                if (this.onCustomerAngry) {
                    this.onCustomerAngry(customer);
                }

                // Retire après animation
                setTimeout(() => {
                    this.removeCustomer(customer);
                    this.customerPositions[posIndex].occupied = false;
                }, 1000);
            }
        }
    }

    /**
     * Dessine les clients
     */
    render(ctx) {
        for (const customer of this.customers) {
            customer.render(ctx);
        }
    }

    /**
     * Vérifie si le joueur est proche du comptoir
     */
    isPlayerNearCounter(player) {
        const playerCenter = player.getCenter();
        const counterY = this.gameMap.counterZone.y;
        return Math.abs(playerCenter.y - counterY) < 60;
    }

    /**
     * Retourne le nombre de clients en attente
     */
    getWaitingCount() {
        return this.customers.filter(c => !c.satisfied && !c.angry).length;
    }
}
