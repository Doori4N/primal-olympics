import {Scene} from "../../core/Scene";
import {NetworkClient} from "../../network/NetworkClient";

export class JoinLobbyScene extends Scene {
    private _joinLobbyDiv!: HTMLDivElement;
    private _joinBtn!: HTMLButtonElement;

    constructor() {
        super("join-lobby");
    }

    public start(): void {
        if (this.game.networkInstance.isHost) return;
        const networkClient = this.game.networkInstance as NetworkClient;

        this._joinLobbyDiv = document.createElement("div");
        this._joinLobbyDiv.className = "menu-background blur-background";
        this._joinLobbyDiv.innerHTML = `
            <div class="top-border">
               <p class="top-title left-title">Join a room</p>
            </div>
            <img src="img/primal-olympics-logo.png" class="bottom-right-logo">
            <div class="bottom-border"></div>
        `;
        this.game.uiContainer.appendChild(this._joinLobbyDiv);

        // back button
        const backBtn: HTMLButtonElement = document.createElement("button");
        backBtn.className = "small-stone-button left-button";
        backBtn.onclick = (): void => {
            this.game.soundManager.playSound("click");
            this.game.networkInstance.clearEventListeners();
            this.game.fadeIn(this.sceneManager.changeScene.bind(this.sceneManager, "menu"));
        };
        backBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");
        this._joinLobbyDiv.appendChild(backBtn);

        // back button image
        const backImg: HTMLImageElement = document.createElement("img");
        backImg.src = "img/back.png";
        backImg.id = "back-img";
        backBtn.appendChild(backImg);

        // container for input and join button
        const elementsDiv: HTMLDivElement = document.createElement("div");
        elementsDiv.className = "big-container";
        this._joinLobbyDiv.appendChild(elementsDiv);

        // text input
        const text: HTMLParagraphElement = document.createElement("p");
        text.innerHTML = "Enter Room ID :";
        elementsDiv.appendChild(text);

        const input: HTMLInputElement = document.createElement("input");
        input.id = "room-id";
        input.placeholder = "Room ID";
        elementsDiv.appendChild(input);

        this._joinBtn = document.createElement("button");
        this._joinBtn.innerHTML = "Join Room";
        this._joinBtn.className = "small-red-stone-button";
        elementsDiv.appendChild(this._joinBtn);

        networkClient.addEventListener("room-not-found", this._onRoomNotFound.bind(this));
        networkClient.addEventListener("connected", this._onClientConnected.bind(this));

        this._joinBtn.onclick = (): void => {
            this.game.soundManager.playSound("click");
            this._joinBtn.disabled = true;
            const hostId: string = input.value;
            networkClient.connectToHost(hostId);
        };
        this._joinBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");
    }

    public destroy(): void {
        super.destroy();
        this.game.uiContainer.removeChild(this._joinLobbyDiv);
    }

    private _onClientConnected(): void {
        this.game.fadeIn(this.sceneManager.changeScene.bind(this.sceneManager, "lobby"));
    }

    private _onRoomNotFound(): void {
        this._joinBtn.disabled = false;
        this.game.displayMessage("Room not found!", "error");
    }
}