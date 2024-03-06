import Peer from "peerjs";
import {PlayerData} from "./types";

export interface INetworkInstance {
    /**
     * @description Tells whether the current instance is the host or not
     */
    isHost: boolean;

    /**
     * @description The peer instance
     */
    peer: Peer;

    /**
     * @description List of player names in the game
     */
    players: PlayerData[];

    playerId: string;

    ping: number;

    addEventListener(event: string, callback: Function): void;

    removeEventListener(event: string, callback: Function): void;

    notify(event: string, ...args: any[]): void;

    clearEventListeners(): void;
}