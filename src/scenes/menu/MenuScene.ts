import {Scene} from "../../core/Scene";
import {NetworkHost} from "../../network/NetworkHost";
import {NetworkClient} from "../../network/NetworkClient";
import {v4 as uuid} from "uuid";
import Peer from "peerjs";

const CONNECTION_RETRY_INTERVAL: number = 500; // connection retry interval in ms

export class MenuScene extends Scene {
    private _menuDiv!: HTMLDivElement;

    constructor() {
        super("menu");
    }

    public start(): void {
        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        this._menuDiv = document.createElement("div");
        this._menuDiv.id = "menu";
        uiContainer.appendChild(this._menuDiv);

        const startBtn: HTMLButtonElement = document.createElement("button");
        startBtn.id = "startBtn";
        startBtn.innerHTML = "Start";
        this._menuDiv.appendChild(startBtn);

        const versionText: HTMLParagraphElement = document.createElement("p");
        versionText.innerHTML = "Version: 0.2.0";
        this._menuDiv.appendChild(versionText);

        startBtn.onclick = this._tryToConnectToServer.bind(this);
    }

    public destroy(): void {
        super.destroy();

        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        uiContainer.innerHTML = "";
    }

    private _tryToConnectToServer(): void {
        const peer = new Peer(uuid());

        peer.on("open", (): void => {
            this._menuDiv.innerHTML = "Connected to server !";
            setTimeout(this._onConnectedToServer.bind(this, peer), 500);
        });

        peer.on("error", (err: any): void => {
            peer.destroy();

            console.log("Error connecting to server: ", err);

            let timer: number = CONNECTION_RETRY_INTERVAL / 1000;
            this._menuDiv.innerHTML = `Error connecting to server... Trying again in ${timer} seconds...`;

            const interval: number = setInterval((): void => {
                timer--;
                if (timer <= 0) {
                    clearInterval(interval);
                    this._tryToConnectToServer();
                }
                else {
                    this._menuDiv.innerHTML = `Error connecting to server... Trying again in ${timer} seconds...`;
                }
            }, 1000);
        });
    }

    private _onConnectedToServer(peer: Peer): void {
        peer.removeAllListeners();

        this._menuDiv.innerHTML = "";

        const hostBtn: HTMLButtonElement = document.createElement("button");
        hostBtn.innerHTML = "Host";
        this._menuDiv.appendChild(hostBtn);

        hostBtn.onclick = (): void => {
            this.game.networkInstance = new NetworkHost(peer);
            this.sceneManager.changeScene("lobby");
        }

        const joinBtn: HTMLButtonElement = document.createElement("button");
        joinBtn.innerHTML = "Join";
        this._menuDiv.appendChild(joinBtn);

        joinBtn.onclick = (): void => {
            this.game.networkInstance = new NetworkClient(peer);
            this.sceneManager.changeScene("joinLobby");
        }
    }
}