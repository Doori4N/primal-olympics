import {NetworkInstance} from "./NetworkInstance";
import Peer, {DataConnection} from "peerjs";
import {NetworkMessage} from "./types";
import {SceneManager} from "../core/SceneManager";

// simulate lag for one way trip (ms)
const LAG: number = 0;

// simulate not constant connection (add 0 to n*2 ms)
const RANDOM_FACTOR: number = 0;

// ping interval (ms)
const PING_INTERVAL: number = 2000;

export class NetworkClient extends NetworkInstance {
    public isHost: boolean = false;
    public isConnected: boolean = false;
    private _sceneManager = SceneManager.getInstance();
    private _pingInterval!: number;

    /**
     * @description The connection to the host peer
     */
    public hostConnection!: DataConnection;

    /**
     * @description The host peer id
     */
    public hostId!: string;

    constructor(peer: Peer, name: string) {
        super(peer, name);

        this.peer.on("error", (err: any): void => {
            console.error("Client error: ", err);
        });

        this._initEventListeners();
    }

    public connectToHost(roomId: string): void {
        const hostId: string = roomId + "-gamesonweb2024";
        this.hostConnection = this.peer.connect(hostId, {metadata: {playerId: this.playerId, playerName: this.playerName}});

        this.hostConnection.on("open", this._onConnectedToHost.bind(this, hostId));

        this.hostConnection.on("data", (data: unknown): void => {
            const msg = data as NetworkMessage;
            this.notify(msg.type, ...msg.data);
        });

        this.hostConnection.on("close", (): void => {
            this.notify("host-disconnected");
            this.disconnect();
        });

        this.hostConnection.on("error", (err: any): void => {
            console.error("Error connecting to host: ", err);
        });
    }

    /**
     * Close the connection to the host
     */
    public disconnect(): void {
        this.hostConnection.close();
        this.isConnected = false;
        clearInterval(this._pingInterval);
        this.clearEventListeners();
    }

    private _onConnectedToHost(hostId: string): void {
        this.isConnected = true;
        this.hostId = hostId;
        this.notify("connected");
        this._sendPingLoop(PING_INTERVAL);
    }

    private _initEventListeners(): void {
        this._listenToChangeScene();
        this._listenToPing();
        this._listenToSyncClientTick();
    }

    public notify(event: string, ...args: any[]): void {
        if (LAG === 0) {
            this._eventManager.notify(event, ...args);
            return;
        }

        // simulate receiving a message with lag
        setTimeout((): void => {
            this._eventManager.notify(event, ...args);
        }, LAG + (Math.random() * RANDOM_FACTOR));
    }

    public sendToHost(event: string, ...args: any[]): void {
        const msg: NetworkMessage = {
            type: event,
            data: args
        };

        if (LAG === 0) {
            this.hostConnection.send(msg);
            return;
        }

        // simulate sending a message with lag
        setTimeout((): void => {
            this.hostConnection.send(msg);
        }, LAG + (Math.random() * RANDOM_FACTOR));
    }

    private _listenToChangeScene(): void {
        this.addEventListener("changeScene", (scene: string): void => {
            this._sceneManager.changeScene(scene);
        });
    }

    private _listenToPing(): void {
        this.addEventListener("pong", (startTime: number): void => {
            this.ping = Math.round((Date.now() - startTime));
        });
    }

    private _sendPingLoop(interval: number): void {
        this._pingInterval = setInterval((): void => {
            const startTime: number = Date.now();
            this.sendToHost("ping", this.peer.id, startTime);
        }, interval);
    }

    private _listenToSyncClientTick(): void {
        this.addEventListener("synchronizeClientTick", (hostTime: number, hostTickIndex: number): void => {
            const clientTime: number = Date.now();
            const latency: number = clientTime - hostTime;
            const tickRate: number = 1000 / this._game.tick;
            this._game.tickIndex = hostTickIndex + Math.ceil(latency / tickRate);
        });
    }
}