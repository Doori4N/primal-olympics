import {INetworkInstance} from "./INetworkInstance";
import Peer, {DataConnection} from "peerjs";
import {v4 as uuid} from "uuid";
import {EventManager} from "../core/EventManager";
import {NetworkMessage} from "./types";

export class NetworkHost implements INetworkInstance {
    public isHost: boolean = true;
    public peer: Peer;
    public connections: DataConnection[] = [];
    public players: string[] = [];
    public ping: number = 0;

    private _eventManager = new EventManager();

    constructor() {
        this.peer = new Peer(uuid());
        this.players.push("player 1");

        this.peer.on("connection", (connection: DataConnection): void => {
            console.log(`${connection.peer} is connected !`);
            this.connections.push(connection);

            // listen for messages from the client
            connection.on("data", (data: unknown): void => {
                const msg = data as NetworkMessage;
                this._eventManager.notify(msg.type, ...msg.data);
            });

            // set player list
            const playerName: string = `player ${this.connections.length + 1}`;
            this.players.push(playerName);

            // tell the host that a new player has joined
            this._eventManager.notify("player-joined", this.players);
        });

        this.peer.on("error", (err: any): void => {
            console.error("Host error: ", err);
        });

        this._initEventListeners();
    }

    private _initEventListeners(): void {
        this._listenToPing();
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

    public sendToAllClients(event: string, ...args: any[]): void {
        this.connections.forEach((connection: DataConnection): void => {
            connection.send({type: event, data: args});
        });
    }

    public sendToClient(event: string, clientId: string, ...args: any[]): void {
        const connection: DataConnection | undefined = this.connections.find((connection: DataConnection): boolean => {
            return connection.peer === clientId;
        });

        if (!connection) throw new Error("Client not found");

        connection.send({type: event, data: args});
    }

    private _listenToPing(): void {
        this.addEventListener("ping", (startTime: number, clientId: string): void => {
            this.sendToClient("pong", clientId, startTime);
        });
    }
}