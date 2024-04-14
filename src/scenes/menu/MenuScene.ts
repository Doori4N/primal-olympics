import {Scene} from "../../core/Scene";
import {NetworkHost} from "../../network/NetworkHost";
import {NetworkClient} from "../../network/NetworkClient";
import {v4 as uuid} from "uuid";
import Peer from "peerjs";
import {NetworkInputManager} from "../../network/NetworkInputManager";

const CONNECTION_RETRY_INTERVAL: number = 500; // connection retry interval in ms

export class MenuScene extends Scene {
    private _menuDiv!: HTMLDivElement;
    private _uiContainer!: Element;

    constructor() {
        super("menu");
    }

    public start(): void {
        this._uiContainer = document.querySelector("#ui")!;

        this._menuDiv = document.createElement("div");
        this._menuDiv.id = "menu";
        this._uiContainer.appendChild(this._menuDiv);

        const startBtn: HTMLButtonElement = document.createElement("button");
        startBtn.id = "startBtn";
        startBtn.innerHTML = "Start";
        this._menuDiv.appendChild(startBtn);

        const versionText: HTMLParagraphElement = document.createElement("p");
        versionText.innerHTML = "Version: 0.3.0";
        this._menuDiv.appendChild(versionText);

        startBtn.onclick = this._tryToConnectToServer.bind(this);
    }

    public destroy(): void {
        super.destroy();
        this._uiContainer.removeChild(this._menuDiv);
    }

    private _tryToConnectToServer(): void {
        const id: string = uuid().slice(0, 6) + "-gamesonweb2024";
        const peer = new Peer(id);

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

        // name input
        const nameInput: HTMLInputElement = document.createElement("input");
        nameInput.type = "text";
        const savedName: string | null = localStorage.getItem("name");
        if (savedName) {
            nameInput.value = savedName;
        }
        else {
            nameInput.placeholder = "Enter your name";
        }
        this._menuDiv.appendChild(nameInput);

        // host button
        const hostBtn: HTMLButtonElement = document.createElement("button");
        hostBtn.innerHTML = "Host";
        this._menuDiv.appendChild(hostBtn);

        hostBtn.onclick = (): void => {
            const name: string = nameInput.value;
            localStorage.setItem("name", name);
            this.game.networkInstance = new NetworkHost(peer, name);
            this.game.networkInputManager = new NetworkInputManager();
            this.sceneManager.changeScene("lobby");
        }

        // join button
        const joinBtn: HTMLButtonElement = document.createElement("button");
        joinBtn.innerHTML = "Join";
        this._menuDiv.appendChild(joinBtn);

        joinBtn.onclick = (): void => {
            const name: string = nameInput.value;
            localStorage.setItem("name", name);
            this.game.networkInstance = new NetworkClient(peer, name);
            this.game.networkInputManager = new NetworkInputManager();
            this.sceneManager.changeScene("joinLobby");
        }
    }
}