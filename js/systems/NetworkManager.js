/**
 * NetworkManager - Gestion du multijoueur P2P avec PeerJS
 */
export const NetworkRole = {
    NONE: 'none',
    HOST: 'host',
    CLIENT: 'client'
};

export const NetworkState = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    WAITING: 'waiting',
    CONNECTED: 'connected',
    IN_GAME: 'inGame'
};

export class NetworkManager {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.role = NetworkRole.NONE;
        this.state = NetworkState.DISCONNECTED;
        this.sessionCode = null;

        // Callbacks
        this.onStateChange = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onGameData = null;
        this.onGameStart = null;

        // Sync data
        this.lastSentData = null;
        this.remotePlayerData = null;
    }

    /**
     * Génère un code de session aléatoire
     */
    generateSessionCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Crée une partie (HOST)
     */
    async hostGame() {
        this.role = NetworkRole.HOST;
        this.state = NetworkState.CONNECTING;
        this.notifyStateChange();

        this.sessionCode = this.generateSessionCode();

        return new Promise((resolve, reject) => {
            // Crée le peer avec l'ID = code de session et config ICE
            this.peer = new Peer(this.sessionCode, {
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Host ready, session code:', id);
                this.state = NetworkState.WAITING;
                this.notifyStateChange();
                resolve(this.sessionCode);
            });

            this.peer.on('connection', (conn) => {
                console.log('Player connected!');
                this.connection = conn;
                this.setupConnectionHandlers();
                this.state = NetworkState.CONNECTED;
                this.notifyStateChange();

                if (this.onPlayerJoined) {
                    this.onPlayerJoined();
                }
            });

            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (err.type === 'unavailable-id') {
                    // Code déjà utilisé, en générer un nouveau
                    this.sessionCode = this.generateSessionCode();
                    this.peer.destroy();
                    this.hostGame().then(resolve).catch(reject);
                } else {
                    this.state = NetworkState.DISCONNECTED;
                    this.notifyStateChange();
                    reject(err);
                }
            });
        });
    }

    /**
     * Rejoint une partie (CLIENT)
     */
    async joinGame(code) {
        this.role = NetworkRole.CLIENT;
        this.state = NetworkState.CONNECTING;
        this.sessionCode = code.toUpperCase();
        this.notifyStateChange();

        return new Promise((resolve, reject) => {
            let connectionResolved = false;

            const handleError = (err, message) => {
                if (connectionResolved) return;
                connectionResolved = true;
                console.error(message, err);
                this.state = NetworkState.DISCONNECTED;
                this.notifyStateChange();
                this.disconnect();
                reject(err);
            };

            // Crée un peer avec config ICE explicite pour aider avec NAT
            this.peer = new Peer({
                debug: 2,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log('Client peer ready with ID:', id);
                console.log('Attempting to connect to host:', this.sessionCode);

                // Se connecte à l'host
                this.connection = this.peer.connect(this.sessionCode, {
                    reliable: true,
                    serialization: 'json'
                });

                if (!this.connection) {
                    handleError(new Error('Failed to create connection'), 'Connection creation failed');
                    return;
                }

                this.connection.on('open', () => {
                    if (connectionResolved) return;
                    connectionResolved = true;

                    console.log('✓ Connected to host successfully!');
                    this.setupConnectionHandlers();
                    this.state = NetworkState.CONNECTED;
                    this.notifyStateChange();
                    resolve();
                });

                this.connection.on('error', (err) => {
                    handleError(err, 'Connection error:');
                });

                // Timeout spécifique pour la connexion au pair
                setTimeout(() => {
                    if (!connectionResolved && this.connection && !this.connection.open) {
                        handleError(new Error('Peer connection timeout - host may not exist'), 'Peer timeout:');
                    }
                }, 10000);
            });

            this.peer.on('error', (err) => {
                // Erreur spécifique si le peer n'existe pas
                if (err.type === 'peer-unavailable') {
                    handleError(new Error('Code de session invalide'), 'Host not found:');
                } else {
                    handleError(err, 'Peer error:');
                }
            });

            // Timeout global
            setTimeout(() => {
                if (!connectionResolved && this.state === NetworkState.CONNECTING) {
                    handleError(new Error('Connection timeout'), 'Global timeout:');
                }
            }, 20000);
        });
    }

    /**
     * Configure les handlers de connexion
     */
    setupConnectionHandlers() {
        this.connection.on('data', (data) => {
            this.handleReceivedData(data);
        });

        this.connection.on('close', () => {
            console.log('Connection closed');
            this.state = NetworkState.DISCONNECTED;
            this.notifyStateChange();

            if (this.onPlayerLeft) {
                this.onPlayerLeft();
            }
        });
    }

    /**
     * Gère les données reçues
     */
    handleReceivedData(data) {
        if (data.type === 'gameStart') {
            this.state = NetworkState.IN_GAME;
            this.notifyStateChange();
            if (this.onGameStart) {
                this.onGameStart(data.payload);
            }
        } else if (data.type === 'gameState') {
            if (this.onGameData) {
                this.onGameData(data.payload);
            }
        } else if (data.type === 'playerState') {
            this.remotePlayerData = data.payload;
        }
    }

    /**
     * Envoie des données au peer
     */
    send(type, payload) {
        if (this.connection && this.connection.open) {
            this.connection.send({ type, payload });
        }
    }

    /**
     * Envoie l'état du joueur local
     */
    sendPlayerState(playerData) {
        this.send('playerState', playerData);
    }

    /**
     * Envoie l'état complet du jeu (HOST only)
     */
    sendGameState(gameState) {
        if (this.role === NetworkRole.HOST) {
            this.send('gameState', gameState);
        }
    }

    /**
     * Lance la partie (HOST only)
     */
    startGame(difficulty) {
        if (this.role === NetworkRole.HOST && this.state === NetworkState.CONNECTED) {
            this.state = NetworkState.IN_GAME;
            this.notifyStateChange();
            this.send('gameStart', { difficulty });
            return true;
        }
        return false;
    }

    /**
     * Retourne les données du joueur distant
     */
    getRemotePlayerData() {
        return this.remotePlayerData;
    }

    /**
     * Vérifie si connecté
     */
    isConnected() {
        return this.state === NetworkState.CONNECTED || this.state === NetworkState.IN_GAME;
    }

    /**
     * Vérifie si c'est l'host
     */
    isHost() {
        return this.role === NetworkRole.HOST;
    }

    /**
     * Déconnecte
     */
    disconnect() {
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.role = NetworkRole.NONE;
        this.state = NetworkState.DISCONNECTED;
        this.sessionCode = null;
        this.remotePlayerData = null;
        this.notifyStateChange();
    }

    /**
     * Notifie le changement d'état
     */
    notifyStateChange() {
        if (this.onStateChange) {
            this.onStateChange(this.state, this.role);
        }
    }
}
