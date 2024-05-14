import {Scene} from "../../core/Scene";
import {NetworkHost} from "../../network/NetworkHost";
import {NetworkClient} from "../../network/NetworkClient";
import {NetworkInputManager} from "../../network/NetworkInputManager";

export class MenuScene extends Scene {
    private _menuDiv!: HTMLDivElement;
    private _nameInput!: HTMLInputElement;

    constructor() {
        super("menu");
    }

    public start(): void {
        this._menuDiv = document.createElement("div");
        this._menuDiv.className = "menu-background blur-background";
        this._menuDiv.innerHTML = `
            <div class="top-border">
               <p class="top-title left-title">Main menu</p>
            </div>
            <img src="img/primal-olympics-logo.png" class="bottom-right-logo">
            <div class="bottom-border"></div>
        `;
        this.game.uiContainer.appendChild(this._menuDiv);

        const elementsDiv: HTMLDivElement = document.createElement("div");
        elementsDiv.id = "elements-div";
        this._menuDiv.appendChild(elementsDiv);

        // name input
        this._nameInput = document.createElement("input");
        this._nameInput.type = "text";
        this._nameInput.id = "name-input";
        this._nameInput.style.backgroundImage = "url('img/leaf-stone-container.svg')";
        this._nameInput.placeholder = "Enter your name...";
        elementsDiv.appendChild(this._nameInput);

        // get saved name from local storage
        const savedName: string | null = localStorage.getItem("name");
        if (savedName) this._nameInput.value = savedName;

        // button container
        const buttonContainer: HTMLDivElement = document.createElement("div");
        buttonContainer.id = "button-container";
        elementsDiv.appendChild(buttonContainer);

        this._createHostButton(buttonContainer);
        this._createJoinButton(buttonContainer);

        // character button
        const characterBtn: HTMLButtonElement = document.createElement("button");
        characterBtn.innerHTML = "Character";
        characterBtn.className = "stone-button";
        buttonContainer.appendChild(characterBtn);

        // character image
        const characterImg: HTMLImageElement = document.createElement("img");
        characterImg.src = "img/cavewoman.png";
        characterImg.id = "character-img";
        characterBtn.appendChild(characterImg);

        this._createOptionsButton();
    }

    public destroy(): void {
        super.destroy();
        this.game.uiContainer.removeChild(this._menuDiv);
    }

    private _createOptionsButton(): void {
        // settings button
        const settingsBtn: HTMLButtonElement = document.createElement("button");
        settingsBtn.className = "small-stone-button left-button";
        this._menuDiv.appendChild(settingsBtn);

        // settings image
        const settingsImg: HTMLImageElement = document.createElement("img");
        settingsImg.src = "img/settings.png";
        settingsImg.id = "settings-img";
        settingsBtn.appendChild(settingsImg);

        // help button
        const helpBtn: HTMLButtonElement = document.createElement("button");
        helpBtn.className = "small-stone-button right-button";
        this._menuDiv.appendChild(helpBtn);

        // help image
        const helpImg: HTMLImageElement = document.createElement("img");
        helpImg.src = "img/help.png";
        helpImg.id = "help-img";
        helpBtn.appendChild(helpImg);
    }

    private _createHostButton(buttonContainer: HTMLDivElement): void {
        // host button
        const hostBtn: HTMLButtonElement = document.createElement("button");
        hostBtn.innerHTML = "Host";
        hostBtn.className = "stone-button";
        buttonContainer.appendChild(hostBtn);

        // host image
        const hostImg: HTMLImageElement = document.createElement("img");
        hostImg.src = "/img/cave.png";
        hostImg.id = "host-img";
        hostBtn.appendChild(hostImg);

        hostBtn.onclick = (): void => {
            if (!this._checkName()) return;
            const name: string = this._nameInput.value;
            localStorage.setItem("name", name);
            this.game.networkInstance = new NetworkHost(this.game.peer, name);
            this.game.networkInputManager = new NetworkInputManager();
            this.sceneManager.changeScene("lobby");
        }
    }

    private _createJoinButton(buttonContainer: HTMLDivElement): void {
        // join button
        const joinBtn: HTMLButtonElement = document.createElement("button");
        joinBtn.innerHTML = "Join";
        joinBtn.className = "stone-button";
        buttonContainer.appendChild(joinBtn);

        // join image
        const joinImg: HTMLImageElement = document.createElement("img");
        joinImg.src = "img/cavemen-drawing.png";
        joinImg.id = "join-img";
        joinBtn.appendChild(joinImg);

        joinBtn.onclick = (): void => {
            if (!this._checkName()) return;
            const name: string = this._nameInput.value;
            localStorage.setItem("name", name);
            this.game.networkInstance = new NetworkClient(this.game.peer, name);
            this.game.networkInputManager = new NetworkInputManager();
            this.game.fadeIn(this.sceneManager.changeScene.bind(this.sceneManager, "join-lobby"));
        }
    }

    private _checkName(): boolean {
        if (this._nameInput.value.length < 3) {
            this.game.displayMessage("Name must be at least 3 characters long!", "error");
            return false;
        }
        else if (this._nameInput.value.length > 12) {
            this.game.displayMessage("Name must be at most 12 characters long!", "error");
            return false;
        }

        return true;
    }
}