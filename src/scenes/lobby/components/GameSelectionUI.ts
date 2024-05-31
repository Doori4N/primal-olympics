import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {MiniGame} from "../../../core/types";

export class GameSelectionUI implements IComponent {
    public name: string = "GameSelectionUI";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _gameSelectionDiv!: HTMLDivElement;

    // event listeners
    private _onDisplayUIEvent = this.displayUI.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("display-mini-games", this._onDisplayUIEvent);
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        this.scene.eventManager.unsubscribe("display-mini-games", this._onDisplayUIEvent);
        this.hideUI();
    }

    public displayUI(): void {
        this._gameSelectionDiv = document.createElement("div");
        this._gameSelectionDiv.className = "menu-background blur-background";
        this._gameSelectionDiv.innerHTML = `
            <div class="top-border">
               <p class="top-title left-title">Mini-games</p>
            </div>
            <img src="img/primal-olympics-logo.png" class="bottom-right-logo">
            <div class="bottom-border"></div>
        `;
        this.scene.game.uiContainer.appendChild(this._gameSelectionDiv);

        // back button
        const backBtn: HTMLButtonElement = document.createElement("button");
        backBtn.className = "small-stone-button left-button";
        backBtn.onclick = (): void => {
            this.scene.game.soundManager.playSound("click");
            this.scene.game.fadeIn((): void => {
                this.scene.eventManager.notify("display-lobby");
                this.hideUI();
            });
        };
        backBtn.onmouseenter = (): void => this.scene.game.soundManager.playSound("select");
        this._gameSelectionDiv.appendChild(backBtn);

        // back button image
        const backImg: HTMLImageElement = document.createElement("img");
        backImg.src = "img/back.png";
        backImg.id = "back-img";
        backBtn.appendChild(backImg);

        // button container
        const buttonContainer: HTMLDivElement = document.createElement("div");
        buttonContainer.id = "mini-games-button-container";
        this._gameSelectionDiv.appendChild(buttonContainer);

        // game buttons
        for (let i: number = 0; i < 6; i++) {
            if (i < this.scene.game.miniGames.length) {
                const gameBtn: HTMLButtonElement = this._createGameButton(this.scene.game.miniGames[i]);
                buttonContainer.appendChild(gameBtn);
            } else {
                const gameBtn: HTMLButtonElement = this._createEmptyGameButton("Coming soon");
                buttonContainer.appendChild(gameBtn);
            }
        }
    }

    private _createGameButton(game: MiniGame): HTMLButtonElement {
        const gameBtn: HTMLButtonElement = this._createEmptyGameButton(game.name);

        const img: HTMLImageElement = document.createElement("img");
        img.src = `img/${game.scene}-background.png`;
        img.className = "mini-game-img";
        gameBtn.appendChild(img);

        // CLIENT
        if (!this.scene.game.networkInstance.isHost) return gameBtn;

        // HOST
        const checkImg: HTMLImageElement = document.createElement("img");
        checkImg.src = "img/check.png";
        checkImg.className = "top-right-img";

        const cancelImg: HTMLImageElement = document.createElement("img");
        cancelImg.src = "img/cancel.png";
        cancelImg.className = "top-right-img";

        if (!game.isSelected) gameBtn.appendChild(cancelImg);
        else gameBtn.appendChild(checkImg);

        gameBtn.onclick = (): void => {
            this.scene.game.soundManager.playSound("click");
            game.isSelected = !game.isSelected;
            game.toPlay = game.isSelected;

            if (game.isSelected) {
                gameBtn.removeChild(cancelImg);
                gameBtn.appendChild(checkImg);
            }
            else {
                gameBtn.removeChild(checkImg);
                gameBtn.appendChild(cancelImg);
            }
        }
        gameBtn.onmouseenter = (): void => this.scene.game.soundManager.playSound("select");

        return gameBtn;
    }

    private _createEmptyGameButton(name: string): HTMLButtonElement {
        const gameBtn: HTMLButtonElement = document.createElement("button");

        // CLIENT
        if (!this.scene.game.networkInstance.isHost) gameBtn.className = "mini-game-button";
        // HOST
        else gameBtn.className = "mini-game-button active-button";

        const nameText: HTMLSpanElement = document.createElement("span");
        nameText.className = "mini-game-text";
        nameText.innerText = name;
        gameBtn.appendChild(nameText);

        return gameBtn;
    }

    public hideUI(): void {
        if (this.scene.game.uiContainer.contains(this._gameSelectionDiv)) {
            this.scene.game.uiContainer.removeChild(this._gameSelectionDiv);
        }
    }
}