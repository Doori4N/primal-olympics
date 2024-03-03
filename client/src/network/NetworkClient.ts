import {INetworkInstance} from "./INetworkInstance";
import Peer, {DataConnection} from "peerjs";
import {v4 as uuid} from "uuid";
import {EventManager} from "../core/EventManager";
import {NetworkMessage} from "./types";
import {SceneManager} from "../core/SceneManager";

export class NetworkClient implements INetworkInstance {
    public isHost: boolean = false;
    public peer: Peer;
    public players: string[] = [];
    public ping: number = 0;
    public lag: number = 150;

    private _eventManager = new EventManager();
    private _sceneManager = SceneManager.getInstance();

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
        this.hostConnection = this.peer.connect(hostId);

        this.hostConnection.on("open", (): void => {
            console.log("Connected to host!");
            this.hostId = hostId;
            this.notify("connected");
        });

        this.hostConnection.on("data", (data: unknown): void => {
            const msg = data as NetworkMessage;
            this.notify(msg.type, ...msg.data);
        });

        this.hostConnection.on("error", (err: any): void => {
            console.error("Error connecting to host: ", err);
        });

        this._sendPingLoop(2000);
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
        // simulate receiving a message with lag
        setTimeout((): void => {
            this._eventManager.notify(event, ...args);
        }, this.lag);
    }

    public clearEventListeners(): void {
        this._eventManager.clear();
    }

    public sendToHost(event: string, ...args: any[]): void {
        const msg: NetworkMessage = {
            type: event,
            data: args
        };

        // simulate sending a message with lag
        setTimeout((): void => {
            this.hostConnection.send(msg);
        }, this.lag);
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
}