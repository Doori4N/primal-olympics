import {INetworkInstance} from "./INetworkInstance";
import Peer, {DataConnection} from "peerjs";
import {v4 as uuid} from "uuid";
import {EventManager} from "../core/EventManager";
import {NetworkMessage, PlayerData} from "./types";
import {InputStates, InputType} from "../core/types";
import {Game} from "../core/Game";

export class NetworkHost implements INetworkInstance {
    public isHost: boolean = true;
    public isConnected: boolean = true;
    public peer: Peer;
    public connections: DataConnection[] = [];
    public players: PlayerData[] = [];
    public playerInputBuffers = new Map<string, InputStates[]>();
    public playerId: string = uuid();
    public ping: number = 0;
    private _isClientTickSynchronized: {[key: string]: boolean} = {};

    private _eventManager = new EventManager();
    private _game: Game = Game.getInstance();

    constructor(peer: Peer) {
        this.peer = peer;

        // initialize the player list with the host
        this.players.push({
            id: this.playerId,
            name: "player 1",
            goldMedals: 0,
            silverMedals: 0,
            bronzeMedals: 0
        });

        this.peer.on("connection", (connection: DataConnection): void => {
            console.log(`${connection.peer} is connected !`);
            console.log(connection.provider);
            this.connections.push(connection);

            // init player inputs buffer
            this.playerInputBuffers.set(connection.metadata.playerId, []);

            // listen for messages from the client
            connection.on("data", (data: unknown): void => {
                const msg = data as NetworkMessage;
                this.notify(msg.type, connection.peer, ...msg.data);
            });

            // set player list
            const playerName: string = `player ${this.connections.length + 1}`;
            this.players.push({
                id: connection.metadata.playerId,
                name: playerName,
                goldMedals: 0,
                silverMedals: 0,
                bronzeMedals: 0
            });

            // tell the host that a new player has joined
            this.notify("player-joined", connection.peer, this.players);
        });

        this.peer.on("error", (err: any): void => {
            console.error("Host error: ", err);
        });

        this._initEventListeners();
    }

    private _initEventListeners(): void {
        this._listenToPing();
        this._listenToPlayerInputStates();
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

    public fixedUpdate(): void {
        // remove the first input state from the buffer for each player
        this.playerInputBuffers.forEach((inputs: InputStates[]): void => {
            if (inputs.length === 0) return;
            inputs.shift();
        });
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

    private _listenToPlayerInputStates(): void {
        this.addEventListener("inputStates", (
            _clientId: string,
            playerId: string,
            inputStates: InputStates
        ): void => {
            // store input states in the buffer with one tick delay
            setTimeout((): void => {
                this.playerInputBuffers.get(playerId)!.push(inputStates);
            }, 1000 / this._game.tick);
        });
    }

    public synchronizeClientTick(): void {
        // reset the flag for each client
        this.connections.forEach((connection: DataConnection): void => {
            this._isClientTickSynchronized[connection.peer] = false;
        });

        this.sendToAllClients("synchronizeClientTick", Date.now(), this._game.tickIndex);
    }

    public getPlayerInput(playerId: string): InputStates {
        const inputStates: InputStates[] = this.playerInputBuffers.get(playerId)!;

        // if the buffer is empty (no input received yet), return a default input state
        if (inputStates.length === 0) {
            return {
                type: InputType.KEYBOARD,
                direction: {
                    x: 0,
                    y: 0
                },
                buttons: {},
                tick: 0
            } as InputStates;
        }

        return inputStates[0];
    }
}