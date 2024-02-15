import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import * as B from '@babylonjs/core';
import {MeshComponent} from "../../components/MeshComponent";

export class ChickenBehaviour implements IComponent {
    public name: string = "ChickenBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private mesh!: B.Mesh;
    private velocityX: number = 0.01;
    private slowDown: number = 0.000005;
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

        this.mesh.position.x += this.velocityX * this.scene.scene.deltaTime;
    }

    public onDestroy(): void {}

    private checkCollisionWithPlayers(players: Entity[]): boolean {
        for (let i: number = 0; i < players.length; i++) {
            const playerMeshComponent = players[i].getComponent("Mesh") as MeshComponent;
            const playerMesh: B.Mesh = playerMeshComponent.mesh;

            if (this.mesh.position.x - 1 < playerMesh.position.x) {
                return true;
            }
        }
        return false;
    }

    private slowDownVelocity(): void {
        if (this.velocityX >= this.slowDown + 0.001) {
            this.velocityX -= this.slowDown;
        }
        else {
            console.log("stopped");
            this.velocityX = 0;
        }
    }
}