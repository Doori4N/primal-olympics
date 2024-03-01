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
}