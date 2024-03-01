import {Scene} from "../../core/Scene";
import {ClientNetwork} from "../../core/network/ClientNetwork";

export class JoinLobbyScene extends Scene {
    constructor() {
        super("joinLobby");
    }

    public start(): void {
        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        const joinLobbyDiv: HTMLDivElement = document.createElement("div");
        joinLobbyDiv.id = "join-lobby";
        uiContainer.appendChild(joinLobbyDiv);

        joinLobbyDiv.innerHTML = `<h2>Join a Room</h2>`;

        const input: HTMLInputElement = document.createElement("input");
        input.id = "room-id";
        input.placeholder = "Room ID";
        joinLobbyDiv.appendChild(input);

        const joinBtn: HTMLButtonElement = document.createElement("button");
        joinBtn.innerHTML = "Join Room";
        joinLobbyDiv.appendChild(joinBtn);

        joinBtn.onclick = (): void => {
            const hostId: string = input.value;

            if (this.game.networkInstance instanceof ClientNetwork) {
                this.game.networkInstance.addEventListener("connected", this._onClientConnected.bind(this));
                this.game.networkInstance.connectToHost(hostId);
            }
        };
    }

    public destroy(): void {
        super.destroy();

        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        uiContainer.innerHTML = "";
    }

    private _onClientConnected(): void {
        this.sceneManager.changeScene("lobby");
    }
}