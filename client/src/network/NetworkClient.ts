import {INetworkInstance} from "./INetworkInstance";
import Peer, {DataConnection} from "peerjs";
import {v4 as uuid} from "uuid";
import {EventManager} from "../core/EventManager";
import {NetworkMessage, PlayerData} from "./types";
import {SceneManager} from "../core/SceneManager";
import {Game} from "../core/Game";

// simulate lag for one way trip (ms)
const LAG: number = 150;

// ping interval (ms)
const PING_INTERVAL: number = 2000;

export class NetworkClient implements INetworkInstance {
    public isHost: boolean = false;
    public peer: Peer;
    public players: PlayerData[] = [];
    public playerId: string = uuid();
    public ping: number = 0;

    private _eventManager = new EventManager();
    private _sceneManager = SceneManager.getInstance();
    private _game = Game.getInstance();

    /**
     * @description The connection to the host peer
     */
    public hostConnection!: DataConnection;

    /**
     * @description The host peer id
     */
    public hostId!: string;

    constructor() {
        this.peer = new Peer(uuid());

        this.peer.on("error", (err: any): void => {
            console.error("Client error: ", err);
        });

        this.peer.on("open", (): void => {
            console.log("Client connected to peer server");
        });

        this._initEventListeners();
    }

    public connectToHost(hostId: string): void {
        this.hostConnection = this.peer.connect(hostId, {metadata: {playerId: this.playerId}});

        this.hostConnection.on("open", this.onConnectedToHost.bind(this, hostId));

        this.hostConnection.on("data", (data: unknown): void => {
            const msg = data as NetworkMessage;
            this.notify(msg.type, ...msg.data);
        });

        this.hostConnection.on("error", (err: any): void => {
            console.error("Error connecting to host: ", err);
        });
    }

    private onConnectedToHost(hostId: string): void {
        console.log("Connected to host!");
        this.hostId = hostId;
        this.notify("connected");

        this._sendPingLoop(PING_INTERVAL);
        this._sendInputStatesLoop(this._game.tickRate);
    }

    private _initEventListeners(): void {
        this._listenToChangeScene();
        this._listenToPing();
    }

    public addEventListener(event: string, callback: Function): void {
        this._eventManager.subscribe(event, callback);
    }

    public removeEventListener(event: string, callback: Function): void {
        this._eventManager.unsubscribe(event, callback);
    }

    public notify(event: string, ...args: any[]): void {
        if (LAG === 0) {
            this._eventManager.notify(event, ...args);
            return;
        }

        // simulate receiving a message with lag
        setTimeout((): void => {
            this._eventManager.notify(event, ...args);
        }, LAG);
    }

    public clearEventListeners(): void {
        this._eventManager.clear();
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
        }, LAG);
    }

    private _listenToChangeScene(): void {
        this.addEventListener("changeScene", (scene: string): void => {
            this._sceneManager.changeScene(scene);
        });
    }

    private _listenToPing(): void {
        this.addEventListener("pong", (startTime: number): void => {
            this.ping = Math.round((Date.now() - startTime));
            console.log("Ping: ", this.ping);
        });
    }

    private _sendPingLoop(interval: number): void {
        setInterval((): void => {
            const startTime: number = Date.now();
            this.sendToHost("ping", startTime, this.peer.id);
        }, interval);
    }

    private _sendInputStatesLoop(interval: number): void {
        setInterval((): void => {
            this.sendToHost("inputStates", this.playerId, this._game.inputs.inputStates);
        }, interval);
    }
}