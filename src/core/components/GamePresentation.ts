import {IComponent} from "../IComponent";
import {Entity} from "../Entity";
import {Scene} from "../Scene";
import {NetworkInstance} from "../../network/NetworkInstance";
import {NetworkClient} from "../../network/NetworkClient";
import {NetworkHost} from "../../network/NetworkHost";
import {Commands} from "../types";

export class GamePresentation implements IComponent {
    public name: string = "GamePresentation";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _timer: number = 45;
    private _isPlayerSkipping!: boolean[];
    private _presentationDiv!: HTMLDivElement;
    private _timerUI!: HTMLParagraphElement;
    private _playerCheckBoxes: {div: HTMLDivElement, check: HTMLImageElement, empty: HTMLImageElement}[] = [];
    private readonly _networkInstance: NetworkInstance;
    private readonly _description: string;
    private readonly _imgSrc: string;
    private readonly _commands: Commands;
    private _canSkip: boolean = true;

    // event listeners
    private _playerSkipEvent = this._onPlayerSkipClientRpc.bind(this);
    private _clientSkipEvent = this._onClientSkipServerRpc.bind(this);

    constructor(entity: Entity, scene: Scene, props: {description: string, imgSrc: string, commands: Commands}) {
        this.entity = entity;
        this.scene = scene;
        this._networkInstance = this.scene.game.networkInstance;
        this._description = props.description;
        this._imgSrc = props.imgSrc;
        this._commands = props.commands;
    }

    public onStart(): void {
        // HOST
        if (this._networkInstance.isHost) {
            this._networkInstance.addEventListener("onClientSkip", this._clientSkipEvent);
        }
        // CLIENT
        else {
            this._networkInstance.addEventListener("onPlayerSkip", this._playerSkipEvent);
        }

        this._isPlayerSkipping = new Array(this._networkInstance.players.length).fill(false);

        this._displayGUI();

        // countdown interval
        const interval: number = setInterval((): void => {
            this._timer--;
            if (this._timer < 1 || this._isPlayerSkipping.every((isSkipping: boolean): boolean => isSkipping)) {
                clearInterval(interval);
                this.scene.game.fadeIn((): void => {
                    this.entity.removeComponent("GamePresentation");
                    this.scene.eventManager.notify("onPresentationFinished");
                });
            }
            else {
                this._updateTimerUI();
            }
        }, 1000);
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        this._checkPlayerSkip();
    }

    public onDestroy(): void {
        this.scene.game.uiContainer.removeChild(this._presentationDiv);

        if (this._networkInstance.isHost) {
            this._networkInstance.removeEventListener("onClientSkip", this._clientSkipEvent);
        }
        else {
            this._networkInstance.removeEventListener("onPlayerSkip", this._playerSkipEvent);
        }
    }

    private _displayGUI(): void {
        this._presentationDiv = document.createElement("div");
        this._presentationDiv.className = "menu-background blur-background";
        this.scene.game.uiContainer.appendChild(this._presentationDiv);

        // top border
        const topBorderDiv: HTMLDivElement = document.createElement("div");
        topBorderDiv.className = "top-border";
        topBorderDiv.innerHTML = `<p class="top-title left-title">${this.scene.name}</p>`;
        this._presentationDiv.appendChild(topBorderDiv);

        // timer
        this._timerUI = document.createElement("p");
        this._timerUI.className = "top-title right-title";
        this._timerUI.innerHTML = `${this._timer}`;
        topBorderDiv.appendChild(this._timerUI);

        // image presentation
        const imgPresentation: HTMLImageElement = document.createElement("img");
        imgPresentation.src = `/img/${this._imgSrc}`;
        imgPresentation.className = "presentation-img";
        this._presentationDiv.appendChild(imgPresentation);

        // description container
        const descriptionContainer: HTMLDivElement = document.createElement("div");
        descriptionContainer.id = "description-container";
        descriptionContainer.innerHTML = `<p>${this._description}</p>`;
        this._presentationDiv.appendChild(descriptionContainer);

        // commands container
        const commandsContainer: HTMLDivElement = document.createElement("div");
        commandsContainer.id = "commands-container";
        this._presentationDiv.appendChild(commandsContainer);

        this._commands.forEach((command: {keys: string[], description: string}): void => {
            const div: HTMLDivElement = this._createCommandUI(command);
            commandsContainer.appendChild(div);
        });

        const checkboxText: HTMLParagraphElement = document.createElement("p");
        checkboxText.id = "checkbox-info-text";
        checkboxText.innerHTML = "Press space to skip...";
        this._presentationDiv.appendChild(checkboxText);

        // checkbox container
        const checkboxContainer: HTMLDivElement = document.createElement("div");
        checkboxContainer.id = "checkbox-container";
        this._presentationDiv.appendChild(checkboxContainer);

        // player checkboxes
        for (let i: number = 0; i < this.scene.game.networkInstance.players.length; i++) {
            const playerCheckboxDiv: HTMLDivElement = document.createElement("div");
            playerCheckboxDiv.className = "player-checkbox";
            playerCheckboxDiv.innerHTML = `<p class="player-name-text">${this.scene.game.networkInstance.players[i].name}</p>`;

            const playerCheckImg: HTMLImageElement = document.createElement("img");
            playerCheckImg.className = "checkbox-img";
            playerCheckImg.src = "/img/stone-checkbox.svg";
            playerCheckImg.alt = "stone-checkbox";

            const playerEmptyImg: HTMLImageElement = document.createElement("img");
            playerEmptyImg.className = "checkbox-img";
            playerEmptyImg.src = "/img/empty-stone-checkbox.svg";
            playerEmptyImg.alt = "empty-stone-checkbox";
            playerCheckboxDiv.appendChild(playerEmptyImg);

            this._playerCheckBoxes.push({
                div: playerCheckboxDiv,
                check: playerCheckImg,
                empty: playerEmptyImg
            });

            checkboxContainer.appendChild(playerCheckboxDiv);
        }
    }

    private _createCommandUI(command: {keys: string[], description: string}): HTMLDivElement {
        const commandDiv: HTMLDivElement = document.createElement("div");
        commandDiv.className = "command";

        const keysDiv: HTMLDivElement = document.createElement("div");
        keysDiv.className = "keys";
        commandDiv.appendChild(keysDiv);

        command.keys.forEach((key: string): void => {
            keysDiv.appendChild(this._getKeyImage(key));
        });

        commandDiv.innerHTML += `<p>${command.description}</p>`;
        return commandDiv;
    }

    private _getKeyImage(key: string): HTMLImageElement {
        const keyImg: HTMLImageElement = document.createElement("img");
        if (key.length > 1) keyImg.className = "large-key-img";
        else keyImg.className = "key-img";
        keyImg.src = `/img/${key}.png`;
        keyImg.alt = key;
        return keyImg;
    }

    private _updateTimerUI(): void {
        this._timerUI.innerHTML = `${this._timer}`;
    }

    private _updatePlayerSkipUI(playerIndex: number): void {
        if (this._isPlayerSkipping[playerIndex]) return;
        const playerCheckBox = this._playerCheckBoxes[playerIndex];
        playerCheckBox.div.removeChild(playerCheckBox.empty);
        playerCheckBox.div.appendChild(playerCheckBox.check);
    }

    private _checkPlayerSkip(): void {
        if (!this.scene.game.inputManager.inputStates.buttons["jump"] || !this._canSkip) return;
        this._canSkip = false;

        const playerIndex: number = this._networkInstance.players.findIndex((player: {id: string}): boolean => player.id === this._networkInstance.playerId);

        // HOST
        if (this._networkInstance.isHost) {
            this._onClientSkipServerRpc(playerIndex);
        }
        // CLIENT
        else {
            const networkClient = this._networkInstance as NetworkClient;
            networkClient.sendToHost("onClientSkip", playerIndex);
        }

        this.scene.game.soundManager.playSound("click");
    }

    private _onPlayerSkipClientRpc(playerIndex: number): void {
        this._updatePlayerSkipUI(playerIndex);
        this._isPlayerSkipping[playerIndex] = true;
        this.scene.game.soundManager.playSound("click");
    }

    private _onClientSkipServerRpc(playerIndex: number): void {
        const networkHost = this._networkInstance as NetworkHost;
        networkHost.sendToAllClients("onPlayerSkip", playerIndex);
        this._onPlayerSkipClientRpc(playerIndex);
    }
}