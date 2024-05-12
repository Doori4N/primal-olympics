import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {NetworkHost} from "../../../network/NetworkHost";

export class GameLobbyUI implements IComponent {
    public name: string = "GameLobbyUI";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private readonly _roomID: string;
    private _lobbyDiv!: HTMLDivElement;
    private _playerNumber!: HTMLParagraphElement;
    private _buttonContainer!: HTMLDivElement;
    private _roundsBtn!: HTMLButtonElement;

    // event listeners
    private _updatePlayerNumberEvent = this._updatePlayerNumber.bind(this);
    private _onDisplayUIEvent = this.displayUI.bind(this);

    constructor(entity: Entity, scene: Scene, props: {roomId: string}) {
        this.entity = entity;
        this.scene = scene;
        this._roomID = props.roomId;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("update-number", this._updatePlayerNumberEvent);
        this.scene.eventManager.subscribe("display-lobby", this._onDisplayUIEvent);
        this.displayUI();
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        this.scene.eventManager.unsubscribe("update-number", this._updatePlayerNumberEvent);
        this.scene.eventManager.unsubscribe("display-lobby", this._onDisplayUIEvent);
        this.hideUI();
    }

    public displayUI(): void {
        this._lobbyDiv = document.createElement("div");
        this._lobbyDiv.innerHTML = `
            <div class="top-border">
               <p class="top-title left-title">Lobby</p>
               <p class="top-title right-title">Room ID: ${this._roomID}</p>
            </div>
            <img src="img/primal-olympics-logo.png" class="bottom-right-logo">
            <div class="bottom-border"></div>
        `;
        this.scene.game.uiContainer.appendChild(this._lobbyDiv);

        // back button
        const backBtn: HTMLButtonElement = document.createElement("button");
        backBtn.className = "small-stone-button left-button";
        backBtn.onclick = (): void => {
            this.scene.game.networkInstance.disconnect();
            this.scene.game.fadeIn(this.scene.sceneManager.changeScene.bind(this.scene.sceneManager, "menu"));
        };
        this._lobbyDiv.appendChild(backBtn);

        // back button image
        const backImg: HTMLImageElement = document.createElement("img");
        backImg.src = "img/back.png";
        backImg.id = "back-img";
        backBtn.appendChild(backImg);

        // player number container
        const circleContainer: HTMLDivElement = document.createElement("div");
        circleContainer.className = "stone-circle";
        this._lobbyDiv.appendChild(circleContainer);

        // player number
        this._playerNumber = document.createElement("p");
        this._playerNumber.className = "stone-number";
        this._playerNumber.innerHTML = `${this.scene.game.networkInstance.players.length} / 8`;
        circleContainer.appendChild(this._playerNumber);

        // button container
        this._buttonContainer = document.createElement("div");
        this._buttonContainer.id = "lobby-button-container";
        this._lobbyDiv.appendChild(this._buttonContainer);

        // selection button
        const selectionBtn: HTMLButtonElement = document.createElement("button");
        selectionBtn.innerHTML = "Mini-games";
        selectionBtn.className = "large-stone-button";
        this._buttonContainer.appendChild(selectionBtn);

        selectionBtn.addEventListener("click", (): void => {
            this.scene.game.fadeIn((): void => {
                this.scene.eventManager.notify("display-mini-games");
                this.hideUI();
            });
        });

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            // round div
            const roundDiv: HTMLDivElement = document.createElement("div");
            roundDiv.id = "round-div";
            this._buttonContainer.appendChild(roundDiv);

            // left arrow
            const leftArrowBtn: HTMLButtonElement = document.createElement("button");
            leftArrowBtn.className = "arrow-button left-arrow";
            leftArrowBtn.onclick = (): void => {
                this.scene.game.rounds = Math.max(1, this.scene.game.rounds - 1);
                this._roundsBtn.innerHTML = `Rounds: ${this.scene.game.rounds}`;
            }
            roundDiv.appendChild(leftArrowBtn);

            // round button
            this._roundsBtn = document.createElement("button");
            this._roundsBtn.innerHTML = `Rounds: ${this.scene.game.rounds}`;
            this._roundsBtn.id = "round-btn";
            this._roundsBtn.className = "large-stone-button";
            roundDiv.appendChild(this._roundsBtn);

            // right arrow
            const rightArrowBtn: HTMLButtonElement = document.createElement("button");
            rightArrowBtn.className = "arrow-button right-arrow";
            rightArrowBtn.onclick = (): void => {
                this.scene.game.rounds = Math.min(15, this.scene.game.rounds + 1);
                this._roundsBtn.innerHTML = `Rounds: ${this.scene.game.rounds}`;
            }
            roundDiv.appendChild(rightArrowBtn);
        }

        // start button
        const startBtn: HTMLButtonElement = document.createElement("button");
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            startBtn.innerHTML = "Start Game";
            startBtn.className = "large-stone-button";
            startBtn.onclick = (): void => {
                if (this._checkMiniGamesNumber()) {
                    networkHost.sendToAllClients("changeScene", "game-selection");
                    this.scene.sceneManager.changeScene("game-selection");
                }
            }
        }
        // CLIENT
        else {
            startBtn.innerHTML = "Waiting host...";
            startBtn.className = "large-stone-button inactive-button";
        }
        this._buttonContainer.appendChild(startBtn);
    }

    public hideUI(): void {
        if (this.scene.game.uiContainer.contains(this._lobbyDiv)) {
            this.scene.game.uiContainer.removeChild(this._lobbyDiv);
        }
    }

    private _updatePlayerNumber(nb: number): void {
        this._playerNumber.innerHTML = `${nb} / 8`;
    }

    private _checkMiniGamesNumber(): boolean {
        const miniGames: {name: string, isSelected: boolean}[] = this.scene.game.miniGames;
        let nbSelected: number = 0;
        miniGames.forEach((game: {name: string, isSelected: boolean}): void => {
            if (game.isSelected) nbSelected++;
        });

        if (nbSelected === 0) {
            this.scene.game.displayMessage("Select at least one mini-game!", "error");
            return false;
        }

        return true;
    }
}