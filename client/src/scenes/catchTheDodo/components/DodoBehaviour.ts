import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from '@babylonjs/core';
import {MeshComponent} from "../../../core/components/MeshComponent";

export class DodoBehaviour implements IComponent {
    public name: string = "DodoBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private mesh!: B.Mesh;
    private velocityX: number = 0.2;
    private slowDown: number = 0.000007;
    private collisionRange: number = 1;
    private isGameStarted: boolean = false;
    private isGameFinished: boolean = false;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this.mesh = meshComponent.mesh;
        this.scene.eventManager.subscribe("onCameraAnimationFinished", (): void => {this.isGameStarted = true});
    }

    public onUpdate(): void {
        if (!this.isGameStarted || this.isGameFinished) return;

        const players: Entity[] = this.scene.entityManager.getEntitiesWithTag("player");

        const isColliding: boolean = this.checkCollisionWithPlayers(players);
        if (isColliding) {
            this.scene.eventManager.notify("onGameFinished");
            this.isGameFinished = true;
        }

        this.slowDownVelocity();

        this.mesh.position.x += this.velocityX;
    }

    public onFixedUpdate(): void {}

    public onDestroy(): void {}

    private checkCollisionWithPlayers(players: Entity[]): boolean {
        for (let i: number = 0; i < players.length; i++) {
            const playerMeshComponent = players[i].getComponent("Mesh") as MeshComponent;
            const playerMesh: B.Mesh = playerMeshComponent.mesh;

            if (this.mesh.position.x - this.collisionRange < playerMesh.position.x) {
                return true;
            }
        }
        return false;
    }

    private slowDownVelocity(): void {
        if (this.velocityX >= this.slowDown + 0.001) {
            this.velocityX -= this.slowDown * this.scene.game.engine.getDeltaTime();
        }
        else {
            console.log("stopped");
            this.velocityX = 0;
        }
    }
}