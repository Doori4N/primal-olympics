import Peer from "peerjs";

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
    players: string[];

    addEventListener(event: string, callback: Function): void;

    removeEventListener(event: string, callback: Function): void;

    notify(event: string, ...args: any[]): void;

    clearEventListeners(): void;
}