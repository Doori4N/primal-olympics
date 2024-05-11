import * as B from "@babylonjs/core";
import {Game} from "./Game";

export class LoadingScreen implements B.ILoadingScreen {
    public loadingUIBackgroundColor: string = "#000000";
    public loadingUIText: string = "Loading...";

    private _loadingDiv!: HTMLDivElement;
    private _game: Game = Game.getInstance();

    displayLoadingUI(): void {
        this._loadingDiv = document.createElement("div");
        this._loadingDiv.className = "menu-background loading-background";
        this._game.uiContainer.appendChild(this._loadingDiv);

        const loadingText: HTMLParagraphElement = document.createElement("p");
        loadingText.id = "start-text";
        loadingText.textContent = this.loadingUIText;
        this._loadingDiv.appendChild(loadingText);

        const icon: HTMLImageElement = document.createElement("img");
        icon.id = "big-icon";
        icon.src = "img/primal-olympics-logo.png";
        this._loadingDiv.appendChild(icon);

        // loading spinner
        const spinner: HTMLDivElement = document.createElement("div");
        spinner.className = "spinner";
        this._loadingDiv.appendChild(spinner);
    }

    hideLoadingUI(): void {
        this._game.uiContainer.removeChild(this._loadingDiv);
        // this._loadingDiv.style.opacity = "0";
        // this._loadingDiv.addEventListener("transitionend", (): void => {
        //     this._game.uiContainer.removeChild(this._loadingDiv);
        // });
    }
}