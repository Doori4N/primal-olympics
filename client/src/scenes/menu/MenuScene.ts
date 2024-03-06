import {Scene} from "../../core/Scene";
import {NetworkHost} from "../../network/NetworkHost";
import {NetworkClient} from "../../network/NetworkClient";

export class MenuScene extends Scene {
    constructor() {
        super("menu");
    }

    public start(): void {
        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        const menuDiv: HTMLDivElement = document.createElement("div");
        menuDiv.id = "menu";
        uiContainer.appendChild(menuDiv);

        const startBtn: HTMLButtonElement = document.createElement("button");
        startBtn.id = "startBtn";
        startBtn.innerHTML = "Start";
        menuDiv.appendChild(startBtn);

        const versionText: HTMLParagraphElement = document.createElement("p");
        versionText.innerHTML = "Version: 0.1.0";
        menuDiv.appendChild(versionText);

        // TODO: put the connection to the network here

        startBtn.onclick = (): void => {
            menuDiv.innerHTML = "";

            const hostBtn: HTMLButtonElement = document.createElement("button");
            hostBtn.innerHTML = "Host";
            menuDiv.appendChild(hostBtn);

            hostBtn.onclick = (): void => {
                this.game.networkInstance = new NetworkHost();
                this.sceneManager.changeScene("lobby");
            }

            const joinBtn: HTMLButtonElement = document.createElement("button");
            joinBtn.innerHTML = "Join";
            menuDiv.appendChild(joinBtn);

            joinBtn.onclick = (): void => {
                this.game.networkInstance = new NetworkClient();
                this.sceneManager.changeScene("joinLobby");
            }
        };
    }

    public destroy(): void {
        super.destroy();

        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        uiContainer.innerHTML = "";
    }
}