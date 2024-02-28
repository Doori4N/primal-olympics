import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {PlayerData} from "../../../core/types";
import {PlayerBehaviour} from "./PlayerBehaviour";
import {GameTimer} from "../../../core/components/GameTimer";

export class GameScores implements IComponent {
    public name: string = "GameScores";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private scores: {playerData: PlayerData, score: number}[] = [];
    private deadPlayers: number = 0;
    private gameTimer!: GameTimer;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onGameStarted", this.initScores.bind(this));
        this.scene.eventManager.subscribe("onMessageFinished", this.displayEventScores.bind(this));

        const gameController: Entity = this.scene.entityManager.getFirstEntityWithTag("gameController");
        this.gameTimer = gameController.getComponent("GameTimer") as GameTimer;
    }

    public onUpdate(): void {}

    public onDestroy(): void {}

    private initScores(): void {
        const players: Entity[] = this.scene.entityManager.getEntitiesWithTag("player");

        players.forEach((player: Entity): void => {
            const playerBehaviourComponent = player.getComponent("PlayerBehaviour") as PlayerBehaviour;
            const playerData: PlayerData = this.scene.game.playerData[playerBehaviourComponent.inputIndex];
            this.scores.push({
                playerData: playerData,
                score: 0
            });
        });
    }

    public setPlayerScore(playerEntity: Entity): void {
        const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
        const playerData: PlayerData = this.scene.game.playerData[playerBehaviourComponent.inputIndex];

        const playerScore = this.scores.find((score): boolean => score.playerData === playerData);
        if (playerScore) {
            playerScore.score = this.gameTimer.timer;
        }

        this.deadPlayers++;
        this.checkGameOver();
    }

    private checkGameOver(): void {
        // check if all players are dead
        if (this.deadPlayers === this.scores.length) {
            this.gameTimer.stopTimer();
        }
    }

    private displayEventScores(): void {
        this.scores.sort((a, b) => a.score - b.score);

        this.setPlayerMedals();

        setTimeout((): void => {
            this.scene.eventManager.notify("onDisplayLeaderboard");
        }, 5000);
    }

    private setPlayerMedals(): void {
        for (let i: number = 0; i < this.scores.length; i++) {
            switch (i) {
                case 0:
                    console.log("First place: ", this.scores[i].playerData.name);
                    this.scores[i].playerData.goldMedals++;
                    break;
                case 1:
                    console.log("Second place: ", this.scores[i].playerData.name);
                    this.scores[i].playerData.silverMedals++;
                    break;
                case 2:
                    console.log("Third place: ", this.scores[i].playerData.name);
                    this.scores[i].playerData.bronzeMedals++;
                    break;
                default:
                    console.log("No medals: ", this.scores[i].playerData.name);
                    break;
            }
        }
    }
}