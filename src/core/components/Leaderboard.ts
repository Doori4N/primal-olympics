import {IComponent} from "../IComponent";
import {Entity} from "../Entity";
import {Scene} from "../Scene";
import {PlayerData} from "../../network/types";

export class Leaderboard implements IComponent {
    public name: string = "Leaderboard";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _timer: number = 20;
    private _leaderboardDiv!: HTMLDivElement;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onDisplayLeaderboard", this.displayLeaderboard.bind(this));
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        this.scene.game.uiContainer.removeChild(this._leaderboardDiv);
    }

    public displayLeaderboard(): void {
        this._leaderboardDiv = document.createElement("div");
        this._leaderboardDiv.className = "menu-background blur-background";
        this._leaderboardDiv.innerHTML = `
            <img src="img/primal-olympics-logo.png" class="bottom-right-logo">
            <div class="bottom-border"></div>
        `;
        this.scene.game.uiContainer.appendChild(this._leaderboardDiv);

        const topBorderDiv: HTMLDivElement = document.createElement("div");
        topBorderDiv.className = "top-border";
        this._leaderboardDiv.appendChild(topBorderDiv);

        const title: HTMLParagraphElement = document.createElement("p");
        title.className = "top-title left-title";
        title.textContent = "Leaderboard";
        topBorderDiv.appendChild(title);

        // timer
        const timerText: HTMLParagraphElement = document.createElement("p");
        timerText.className = "top-title right-title";
        timerText.textContent = `${this._timer}`;
        topBorderDiv.appendChild(timerText);

        // sort players by score
        const sortedPlayers: PlayerData[] = this.scene.game.networkInstance.players.slice();
        sortedPlayers.sort(this._compareMedals.bind(this));

        let playerScores: string = `<div id="player-scores-container">`;
        for (let i: number = 0; i < sortedPlayers.length; i++) {
            playerScores += this._getPlayerScoreUI(i + 1, sortedPlayers[i]);
        }
        playerScores += `</div>`;
        this._leaderboardDiv.innerHTML += playerScores;

        // countdown interval
        const interval: number = setInterval((): void => {
            this._timer--;
            if (this._timer < 0) {
                clearInterval(interval);
                this.scene.game.fadeIn((): void => {
                    this.scene.sceneManager.changeScene("game-selection");
                });
            }
            else {
                this._updateTimer();
            }
        }, 1000);
    }

    private _getPlayerScoreUI(index: number, playerData: PlayerData): string {
        return `
            <div class="player-score">
                <div class="position">${index}</div>
                <div class="medals">
                    <div class="medal-name-container">
                        <p class="medal-name">${playerData.name}</p>
                    </div>
                    <div class="vertical-div"></div>
                    <p>${playerData.goldMedals}</p>
                    <img src="img/gold-medal.png" alt="gold-medal" class="medal-img">
                    <div class="vertical-div"></div>
                    <p>${playerData.silverMedals}</p>
                    <img src="img/silver-medal.png" alt="silver-medal" class="medal-img">
                    <div class="vertical-div"></div>
                    <p>${playerData.bronzeMedals}</p>
                    <img src="img/bronze-medal.png" alt="bronze-medal" class="medal-img">
                    <div class="vertical-div"></div>
                    <p class="medal-result">Total: ${this._getScore(playerData)}</p>
                </div>
            </div>
        `
    }

    private _updateTimer(): void {
        const timerText = document.querySelector(".top-title.right-title") as HTMLParagraphElement;
        timerText.textContent = `${this._timer}`;
    }

    private _compareMedals(a: PlayerData, b: PlayerData): number {
        return this._getScore(b) - this._getScore(a);
    }

    private _getScore(player: PlayerData): number {
        return player.goldMedals * 3 + player.silverMedals * 2 + player.bronzeMedals;
    }
}