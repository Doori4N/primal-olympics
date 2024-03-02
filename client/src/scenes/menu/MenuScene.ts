import {Scene} from "../../core/Scene";
import {NetworkHost} from "../../core/network/NetworkHost";
import {NetworkClient} from "../../core/network/NetworkClient";

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

        const localBtn: HTMLButtonElement = document.createElement("button");
        localBtn.id = "localBtn";
        localBtn.innerHTML = "Local";
        menuDiv.appendChild(localBtn);

        const onlineBtn: HTMLButtonElement = document.createElement("button");
        onlineBtn.id = "onlineBtn";
        onlineBtn.innerHTML = "Online";
        menuDiv.appendChild(onlineBtn);

        const versionText: HTMLParagraphElement = document.createElement("p");
        versionText.innerHTML = "Version: 0.0.0";
        menuDiv.appendChild(versionText);

        localBtn.onclick = (): void => {
            menuDiv.innerHTML = "";

            const localSceneDiv: HTMLDivElement = document.createElement("div");
            localSceneDiv.id = "localScene";
            menuDiv.appendChild(localSceneDiv);

            this.game.inputs.onKeyboardConnected.push((): void => {
                localSceneDiv.innerHTML += "Keyboard connected<br>";
                this.addPlayer();
            });
            this.game.inputs.onGamepadConnected.push((): void => {
                localSceneDiv.innerHTML += "Gamepad connected<br>";
                this.addPlayer();
            });

            const startBtn: HTMLButtonElement = document.createElement("button");
            startBtn.innerHTML = "Start Game";
            menuDiv.appendChild(startBtn);

            startBtn.onclick = (): void => {
                if (this.game.playerData.length > 0) {
                    this.sceneManager.changeScene("gameSelection");
                }
            }
        };

        onlineBtn.onclick = (): void => {
            menuDiv.innerHTML = "";

            this.game.isOnline = true;

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

        this.game.inputs.onKeyboardConnected = [];
        this.game.inputs.onGamepadConnected = [];
    }

    private addPlayer(): void {
        this.game.playerData.push({
            name: "Player " + (this.game.playerData.length + 1),
            goldMedals: 0,
            silverMedals: 0,
            bronzeMedals: 0
        })
    }
}