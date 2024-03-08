import {IComponent} from "../../../../core/IComponent";
import {Entity} from "../../../../core/Entity";
import {Scene} from "../../../../core/Scene";
import {MeshComponent} from "../../../../core/components/MeshComponent";
import {PlayerBehaviour} from "../PlayerBehaviour";

export class PlayersController implements IComponent {
    public name: string = "PlayersController";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private maxDistance: number = 35;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {}

    public onUpdate(): void {
        this.checkSlowPlayers();
    }

    public onFixedUpdate(): void {}

    public onDestroy(): void {}

    private checkSlowPlayers(): void {
        const players: Entity[] = this.scene.entityManager.getEntitiesWithTag("player");
        if (players.length <= 1) return;

        const playerPositions: {player: Entity, position: number}[] = [];
        players.forEach((player: Entity): void => {
            const playerMesh = player.getComponent("Mesh") as MeshComponent;
            const playerBehaviour = player.getComponent("PlayerBehaviour") as PlayerBehaviour;

            if (playerBehaviour.isStopped) return;

            playerPositions.push({
                player: player,
                position: playerMesh.mesh.position.x
            });
        });

        playerPositions.sort((a, b) => b.position - a.position);

        // check if all players are within maxDistance from the leader
        for (let i: number = 1; i < playerPositions.length; i++) {
            if (playerPositions[0].position - this.maxDistance > playerPositions[i].position) {
                const playerBehaviour = playerPositions[i].player.getComponent("PlayerBehaviour") as PlayerBehaviour;
                playerBehaviour.stopPlayer();
            }
        }
    }
}