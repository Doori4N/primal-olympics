import {Scene} from "../../core/Scene";
import {v4 as uuid} from "uuid";
import Peer from "peerjs";

const CONNECTION_RETRY_INTERVAL: number = 3000; // connection retry interval in ms

export class StartScene extends Scene {
    private _startDiv!: HTMLDivElement;
    private _startText!: HTMLParagraphElement;
    private _canClick: boolean = true;

    constructor() {
        super("start");
    }

    public start(): void {
        this._startDiv = document.createElement("div");
        this._startDiv.className = "menu-background";
        this.game.uiContainer.appendChild(this._startDiv);

        this._startText = document.createElement("p");
        this._startText.id = "start-text";
        this._startText.textContent = "Press SPACE to start";
        this._startDiv.appendChild(this._startText);

        const versionText: HTMLParagraphElement = document.createElement("p");
        versionText.id = "versionText";
        versionText.innerHTML = "Version: 0.5.0";
        this._startDiv.appendChild(versionText);

        const icon: HTMLImageElement = document.createElement("img");
        icon.id = "big-icon";
        icon.src = "img/primal-olympics-logo.png";
        this._startDiv.appendChild(icon);

        this.game.soundManager.playSound("jungle");
    }

    public destroy(): void {
        super.destroy();
        this.game.uiContainer.removeChild(this._startDiv);
    }

    public update(): void {
        super.update();

        if (this.game.inputManager.inputStates.buttons["jump"] && this._canClick) {
            this._canClick = false;
            this.game.soundManager.playSound("click");
            this._tryToConnectToServer();
        }
    }

    private _tryToConnectToServer(): void {
        const id: string = uuid().slice(0, 6) + "-gamesonweb2024";
        const peer = new Peer(id);

        peer.on("open", (): void => {
            this._startText.textContent = "connecting to server...";
            this._startText.style.color = "green";
            this.game.fadeIn(this._onConnectedToServer.bind(this, peer));
        });

        peer.on("error", (err: any): void => {
            peer.destroy();

            console.log("Error connecting to server: ", err);

            let timer: number = CONNECTION_RETRY_INTERVAL / 1000;
            this._startText.textContent = `Can't connect to server\nTrying again in ${timer} seconds...`;
            this._startText.style.color = "red";

            const interval: number = setInterval((): void => {
                timer--;
                if (timer <= 0) {
                    clearInterval(interval);
                    this._tryToConnectToServer();
                }
                else {
                    this._startText.textContent = `Can't connect to server\nTrying again in ${timer} seconds...`;
                }
            }, 1000);
        });

        // loading spinner
        const spinner: HTMLDivElement = document.createElement("div");
        spinner.className = "spinner";
        this._startDiv.appendChild(spinner);
    }

    private _onConnectedToServer(peer: Peer): void {
        peer.removeAllListeners();
        this.game.peer = peer;
        this.sceneManager.changeScene("menu");
    }
}