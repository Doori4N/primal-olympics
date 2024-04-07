import {Scene} from "../../core/Scene";
import {NetworkClient} from "../../network/NetworkClient";

export class JoinLobbyScene extends Scene {
    private _uiContainer!: Element;
    private _joinLobbyDiv!: HTMLDivElement;

    constructor() {
        super("joinLobby");
    }

    public start(): void {
        if (this.game.networkInstance.isHost) return;
        const networkClient = this.game.networkInstance as NetworkClient;

        this._uiContainer = document.querySelector("#ui")!;

        this._joinLobbyDiv = document.createElement("div");
        this._joinLobbyDiv.id = "join-lobby";
        this._uiContainer.appendChild(this._joinLobbyDiv);

        this._joinLobbyDiv.innerHTML = `<h2>Join a Room</h2>`;

        const input: HTMLInputElement = document.createElement("input");
        input.id = "room-id";
        input.placeholder = "Room ID";
        this._joinLobbyDiv.appendChild(input);

        const joinBtn: HTMLButtonElement = document.createElement("button");
        joinBtn.innerHTML = "Join Room";
        this._joinLobbyDiv.appendChild(joinBtn);

        joinBtn.onclick = (): void => {
            joinBtn.disabled = true;
            this.game.engine.displayLoadingUI();

            const hostId: string = input.value;

            networkClient.addEventListener("connected", this._onClientConnected.bind(this));
            networkClient.connectToHost(hostId);
        };
    }

    public destroy(): void {
        super.destroy();
        this._uiContainer.removeChild(this._joinLobbyDiv);
    }

    private _onClientConnected(): void {
        this.game.engine.hideLoadingUI();
        this.sceneManager.changeScene("lobby");
    }
}