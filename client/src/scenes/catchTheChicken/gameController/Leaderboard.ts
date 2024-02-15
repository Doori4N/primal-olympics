import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {playerData} from "../../../core/types";

export class Leaderboard implements IComponent {
    public name: string = "Leaderboard";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private timer: number = 10;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onDisplayLeaderboard", this.displayLeaderboard.bind(this));
    }

    public onUpdate(): void {}

    public onDestroy(): void {}

    public displayLeaderboard(): void {
        // sort players by score
        const sortedPlayers: playerData[] = this.scene.game.playerData.slice();
        sortedPlayers.sort(this.compareMedals.bind(this));

        let playerScores: string = "";
        for (let i: number = 0; i < sortedPlayers.length; i++) {
            playerScores += `<li>${sortedPlayers[i].name}: 
                                ${sortedPlayers[i].goldMedals}g
                                ${sortedPlayers[i].silverMedals}s
                                ${sortedPlayers[i].bronzeMedals}b
                                [${this.getScore(sortedPlayers[i])}]
                            </li>`;
        }

        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        uiContainer.innerHTML = `
            <div id="leaderboard">
                <h1>Leaderboard</h1>
                <ol>
                    ${playerScores}
                </ol>
            </div>
            <p id="timer">Next game in ${this.timer} seconds</p>
        `;

        // countdown interval
        const interval: number = setInterval((): void => {
            this.timer--;
            if (this.timer < 0) {
                clearInterval(interval);
                this.scene.sceneManager.changeScene("gameSelection");
            }
            else {
                this.updateTimerUI();
            }
        }, 1000);
    }

    private updateTimerUI(): void {
        const timerUI: Element | null = document.querySelector("#timer");
        if (!timerUI) throw new Error("Timer element not found");

        timerUI.textContent = `Next game in ${this.timer} seconds`;
    }

    private compareMedals(a: playerData, b: playerData): number {
        return this.getScore(b) - this.getScore(a);
    }

    private getScore(player: playerData): number {
        return player.goldMedals * 3 + player.silverMedals * 2 + player.bronzeMedals;
    }
}