import {INetworkInstance} from "./INetworkInstance";
import Peer, {DataConnection} from "peerjs";
import {v4 as uuid} from "uuid";
import {EventManager} from "../EventManager";
import {NetworkMessage} from "./types";
import {SceneManager} from "../SceneManager";

export class NetworkClient implements INetworkInstance {
    public isHost: boolean = false;
    public peer: Peer;
    public players: string[] = [];

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

        this._initEventListeners();
    }

    public connectToHost(hostId: string): void {
        this.hostConnection = this.peer.connect(hostId);

        this.hostConnection.on("open", (): void => {
            console.log("Connected to host!");
            this.hostId = hostId;
            this._eventManager.notify("connected");
        });

        this.hostConnection.on("data", (data: unknown): void => {
            const msg = data as NetworkMessage;
            this._eventManager.notify(msg.type, ...msg.data);
        });

        this.hostConnection.on("error", (err: any): void => {
            console.error("Error connecting to host: ", err);
        });
    }

    private _initEventListeners(): void {
        this._listenToChangeScene();
    }

    public addEventListener(event: string, callback: Function): void {
        this._eventManager.subscribe(event, callback);
    }

    public removeEventListener(event: string, callback: Function): void {
        this._eventManager.unsubscribe(event, callback);
    }

    public notify(event: string, ...args: any[]): void {
        this._eventManager.notify(event, ...args);
    }

    public clearEventListeners(): void {
        this._eventManager.clear();
    }

    public sendToHost(event: string, ...args: any[]): void {
        const msg: NetworkMessage = {
            type: event,
            data: args
        };

        this.hostConnection.send(msg);
    }

    private _listenToChangeScene(): void {
        this.addEventListener("changeScene", (scene: string): void => {
            this._sceneManager.changeScene(scene);
        });
    }
}