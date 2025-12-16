/**
 * AssetLoader - Chargement et gestion des assets
 * Prévu pour images et sons futurs
 */
export class AssetLoader {
    constructor() {
        this.images = new Map();
        this.sounds = new Map();
        this.loaded = false;
    }

    /**
     * Charge une image
     */
    async loadImage(name, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images.set(name, img);
                resolve(img);
            };
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            img.src = src;
        });
    }

    /**
     * Charge plusieurs images
     */
    async loadImages(imageMap) {
        const promises = Object.entries(imageMap).map(
            ([name, src]) => this.loadImage(name, src)
        );
        await Promise.all(promises);
    }

    /**
     * Récupère une image chargée
     */
    getImage(name) {
        return this.images.get(name);
    }

    /**
     * Charge un son (pour le futur)
     */
    async loadSound(name, src) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => {
                this.sounds.set(name, audio);
                resolve(audio);
            };
            audio.onerror = () => reject(new Error(`Failed to load sound: ${src}`));
            audio.src = src;
        });
    }

    /**
     * Joue un son
     */
    playSound(name, volume = 1.0) {
        const sound = this.sounds.get(name);
        if (sound) {
            const clone = sound.cloneNode();
            clone.volume = volume;
            clone.play().catch(() => { }); // Ignore autoplay restrictions
        }
    }
}
