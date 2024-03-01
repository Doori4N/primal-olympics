import {Scene} from "../../core/Scene";
import {HostNetwork} from "../../core/network/HostNetwork";
import {ClientNetwork} from "../../core/network/ClientNetwork";

export class LobbyScene extends Scene {
    private _lobbyDiv!: HTMLDivElement;

    constructor() {
        super("lobby");
    }

    public start(): void {
        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        this._lobbyDiv = document.createElement("div");
        this._lobbyDiv.id = "lobby";
        uiContainer.appendChild(this._lobbyDiv);

        if (!this.game.networkInstance) throw new Error("Network instance not found");

        if (this.game.networkInstance.isHost) {
            this._handleHost();
        }
        else {
            this._handleClient();
        }
    }

    public destroy(): void {
        super.destroy();

        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        uiContainer.innerHTML = "";
    }

    private _handleHost(): void {
        const hostNetwork = this.game.networkInstance as HostNetwork;
        this._lobbyDiv.innerHTML = `
                <h2>Room ID: ${hostNetwork.peer.id}</h2>
                <ul id="player-list">
                    <li>${hostNetwork.players[0]}</li>
                </ul>
            `;

        // if a player joins, update the player list
        hostNetwork.addEventListener("player-joined", (players: string[]): void => {
            this._updatePlayerList(players);
        });

        hostNetwork.addEventListener("getPlayers", (): void => {
            // tell to all players to update their player list
            hostNetwork.sendToAllClients("setPlayers", hostNetwork.players);
        });

        const startBtn: HTMLButtonElement = document.createElement("button");
        startBtn.innerHTML = "Start Game";
        this._lobbyDiv.appendChild(startBtn);
    }

    private _handleClient(): void {
        const clientNetwork = this.game.networkInstance as ClientNetwork;

        this._lobbyDiv.innerHTML = `
                <h2>Room ID: ${clientNetwork.hostId}</h2>
                <ul id="player-list"></ul>
                <p>Waiting for host to start the game...</p>
            `;

        // if a player joins, update the player list
        clientNetwork.addEventListener("setPlayers", (players: string[]): void => {
            clientNetwork.players = players;
            this._updatePlayerList(players);
        });

        // get the player list from the host
        clientNetwork.sendToHost("getPlayers");
    }

    private _updatePlayerList(players: string[]): void {
        const playerList: HTMLUListElement | null = document.querySelector("#player-list");
        if (!playerList) throw new Error("Player list not found");

        playerList.innerHTML = "";
        players.forEach((player: string): void => {
            const li: HTMLLIElement = document.createElement("li");
            li.innerHTML = player;
            playerList.appendChild(li);
        });
    }
}