import Peer from "peerjs";
import {PlayerData} from "./types";
import {v4 as uuid} from "uuid";
import {EventManager} from "../core/EventManager";
import {Game} from "../core/Game";

export abstract class NetworkInstance {
    // tells whether the current instance is the host or not
    public isHost!: boolean;
    public isConnected!: boolean;
    // the peer instance
    public peer: Peer;
    public playerName: string;
    // the list of players with their data
    public players: PlayerData[] = [];
    public playerId: string = uuid();
    public ping: number = 0;

    protected _eventManager = new EventManager();
    protected _game = Game.getInstance();

    protected constructor(peer: Peer, name: string) {
        this.peer = peer;
        this.playerName = name;
    }

    public abstract disconnect(): void;

    public addEventListener(event: string, callback: Function): void {
        this._eventManager.subscribe(event, callback);
    }

    public removeEventListener(event: string, callback: Function): void {
        this._eventManager.unsubscribe(event, callback);
    }

    public removeAllEventListeners(event: string): void {
        this._eventManager.unsubscribeAll(event);
    }

    public notify(event: string, ...args: any[]): void {
        this._eventManager.notify(event, ...args);
    }

    public clearEventListeners(): void {
        this._eventManager.clear();
    }
}