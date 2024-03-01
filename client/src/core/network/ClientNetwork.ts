import {INetworkInstance} from "./INetworkInstance";
import Peer, {DataConnection} from "peerjs";
import {v4 as uuid} from "uuid";
import {EventManager} from "../EventManager";
import {NetworkMessage} from "./types";

export class ClientNetwork implements INetworkInstance {
    public isHost: boolean = false;
    public peer: Peer;
    public players: string[] = [];

    private eventManager = new EventManager();

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
    }

    public connectToHost(hostId: string): void {
        this.hostConnection = this.peer.connect(hostId);

        this.hostConnection.on("open", (): void => {
            console.log("Connected to host!");
            this.hostId = hostId;
            this.eventManager.notify("connected");
        });

        this.hostConnection.on("data", (data: unknown): void => {
            const msg = data as NetworkMessage;
            this.eventManager.notify(msg.type, ...msg.data);
        });

        this.hostConnection.on("error", (err: any): void => {
            console.error("Error connecting to host: ", err);
        });
    }

    public addEventListener(event: string, callback: Function): void {
        this.eventManager.subscribe(event, callback);
    }

    public removeEventListener(event: string, callback: Function): void {
        this.eventManager.unsubscribe(event, callback);
    }

    public notify(event: string, ...args: any[]): void {
        this.eventManager.notify(event, ...args);
    }

    public sendToHost(event: string, ...args: any[]): void {
        const msg: NetworkMessage = {
            type: event,
            data: args
        };

        this.hostConnection.send(msg);
    }
}