import {NetworkInstance} from "./NetworkInstance";
import Peer, {DataConnection} from "peerjs";
import {NetworkMessage, PlayerData} from "./types";

export class NetworkHost extends NetworkInstance {
    public isHost: boolean = true;
    public isConnected: boolean = true;
    public connections: DataConnection[] = [];
    private _isClientTickSynchronized: {[key: string]: boolean} = {};

    constructor(peer: Peer, name: string) {
        super(peer, name);

        // initialize the player list with the host
        this.players.push({
            id: this.playerId,
            name: this.playerName,
            goldMedals: 0,
            silverMedals: 0,
            bronzeMedals: 0
        });

        this.peer.on("connection", (connection: DataConnection): void => {
            this.connections.push(connection);

            // listen for messages from the client
            connection.on("data", (data: unknown): void => {
                const msg = data as NetworkMessage;
                this.notify(msg.type, ...msg.data);
            });

            // listen for the client closing the connection
            connection.on("close", (): void => {
                // remove the player from the list
                this.players = this.players.filter((player: PlayerData): boolean => {
                    return player.id !== connection.metadata.playerId;
                });

                // remove the connection from the list
                this.connections = this.connections.filter((conn: DataConnection): boolean => {
                    return conn.peer !== connection.peer;
                });

                // tell the host that a player has left
                this.notify("player-left", connection.metadata.playerId);
            });

            // set player list
            const newPlayer = {
                id: connection.metadata.playerId,
                name: connection.metadata.playerName,
                goldMedals: 0,
                silverMedals: 0,
                bronzeMedals: 0
            }
            this.players.push(newPlayer);

            // tell the host that a new player has joined
            this.notify("player-joined", newPlayer);
        });

        this.peer.on("error", (err: any): void => {
            console.error("Host error: ", err);
        });

        this._initEventListeners();
    }

    /**
     * Close all connections
     */
    public disconnect(): void {
        this.isConnected = false;
        this.connections.forEach((connection: DataConnection): void => {
            connection.close();
        });
        this.clearEventListeners();
        this.peer.removeAllListeners();
    }

    private _initEventListeners(): void {
        this._listenToPing();
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
        this.addEventListener("ping", (clientId: string, startTime: number): void => {
            this.sendToClient("pong", clientId, startTime);
        });
    }

    public synchronizeClientTick(): void {
        // reset the flag for each client
        this.connections.forEach((connection: DataConnection): void => {
            this._isClientTickSynchronized[connection.peer] = false;
        });

        this.sendToAllClients("synchronizeClientTick", Date.now(), this._game.tickIndex);
    }
}