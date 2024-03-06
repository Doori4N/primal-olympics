import {Scene} from "../../core/Scene";
import {NetworkHost} from "../../network/NetworkHost";
import {NetworkClient} from "../../network/NetworkClient";
import {PlayerData} from "../../network/types";

export class LobbyScene extends Scene {
    private _lobbyDiv!: HTMLDivElement;

    // event listeners
    private _addPlayer = this._addPlayerHostRpc.bind(this);
    private _getPlayers = this._getPlayersHostRpc.bind(this);
    private _setPlayers = this._setPlayersClientRpc.bind(this);

    constructor() {
        super("lobby");
    }

    public start(): void {
        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        this._lobbyDiv = document.createElement("div");
        this._lobbyDiv.id = "lobby";
        uiContainer.appendChild(this._lobbyDiv);

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

        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.removeEventListener("player-joined", this._addPlayer);
            networkHost.removeEventListener("getPlayers", this._getPlayers);
        }
        else {
            const networkClient = this.game.networkInstance as NetworkClient;
            networkClient.removeEventListener("setPlayers", this._setPlayers);
        }
    }

    private _handleHost(): void {
        const networkHost = this.game.networkInstance as NetworkHost;
        this._lobbyDiv.innerHTML = `
                <h2>Room ID: ${networkHost.peer.id}</h2>
                <ul id="player-list">
                    <li>${networkHost.players[0].name}</li>
                </ul>
            `;

        // if a player joins, update the player list
        networkHost.addEventListener("player-joined", this._addPlayer);

        networkHost.addEventListener("getPlayers", this._getPlayers);

        const startBtn: HTMLButtonElement = document.createElement("button");
        startBtn.innerHTML = "Start Game";
        this._lobbyDiv.appendChild(startBtn);

        startBtn.onclick = (): void => {
            networkHost.sendToAllClients("changeScene", "gameSelection");
            this.sceneManager.changeScene("gameSelection");
        }
    }

    private _handleClient(): void {
        const networkClient = this.game.networkInstance as NetworkClient;

        this._lobbyDiv.innerHTML = `
            <h2>Room ID: ${networkClient.hostId}</h2>
            <ul id="player-list"></ul>
            <p>Waiting for host to start the game...</p>
        `;

        // if a player joins, update the player list
        networkClient.addEventListener("setPlayers", this._setPlayers);

        // get the player list from the host
        networkClient.sendToHost("getPlayers");
    }

    private _updatePlayerList(players: PlayerData[]): void {
        const playerList: HTMLUListElement | null = document.querySelector("#player-list");
        if (!playerList) throw new Error("Player list not found");

        playerList.innerHTML = "";
        players.forEach((player: PlayerData): void => {
            const li: HTMLLIElement = document.createElement("li");
            li.innerHTML = player.name;
            playerList.appendChild(li);
        });
    }

    private _setPlayersClientRpc(players: PlayerData[]): void {
        const networkClient = this.game.networkInstance as NetworkClient;
        networkClient.players = players;
        this._updatePlayerList(players);
    }

    private _getPlayersHostRpc(_clientId: string): void {
        const networkHost = this.game.networkInstance as NetworkHost;
        // tell to all players to update their player list
        networkHost.sendToAllClients("setPlayers", networkHost.players);
    }

    private _addPlayerHostRpc(_clientId: string, players: PlayerData[]): void {
        this._updatePlayerList(players);
    }
}