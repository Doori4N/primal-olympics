import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {PlayerBehaviour} from "../PlayerBehaviour";
import {MeshComponent} from "../../../components/MeshComponent";

export class EventScores implements IComponent {
    public name: string = "EventScores";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private scores: {index: number, score: number}[] = [];

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onGameFinished", this.onGameFinished.bind(this));
        this.scene.eventManager.subscribe("onMessageFinished", this.displayEventScores.bind(this));
    }

    public onUpdate(): void {}

    public onDestroy(): void {}

    private displayEventScores(): void {
        this.setPlayerMedals();

        setTimeout((): void => {
            this.scene.eventManager.notify("onDisplayLeaderboard");
        }, 5000);
    }

    private onGameFinished(): void {
        this.scores = this.getScores();
    }

    private getScores(): {index: number, score: number}[] {
        const players: Entity[] = this.scene.entityManager.getEntitiesWithTag("player");
        const scores: {index: number, score: number}[] = [];

        players.forEach((player: Entity): void => {
            const playerBehaviour = player.getComponent("PlayerBehaviour") as PlayerBehaviour;
            const playerMesh = player.getComponent("Mesh") as MeshComponent;
            const playerIndex: number = playerBehaviour.inputIndex;
            scores.push({
                index: playerIndex,
                score: Math.round(playerMesh.mesh.position.x)
            });
        });

        scores.sort((a, b) => b.score - a.score);

        return scores;
    }

    private setPlayerMedals(): void {
        for (let i: number = 0; i < this.scores.length; i++) {
            switch (i) {
                case 0:
                    console.log("First place: ", this.scene.game.playerData[this.scores[i].index].name);
                    this.scene.game.playerData[this.scores[i].index].goldMedals++;
                    break;
                case 1:
                    console.log("Second place: ", this.scene.game.playerData[this.scores[i].index].name);
                    this.scene.game.playerData[this.scores[i].index].silverMedals++;
                    break;
                case 2:
                    console.log("Third place: ", this.scene.game.playerData[this.scores[i].index].name);
                    this.scene.game.playerData[this.scores[i].index].bronzeMedals++;
                    break;
                default:
                    console.log("No medals: ", this.scene.game.playerData[this.scores[i].index].name);
                    break;
            }
        }
    }
}