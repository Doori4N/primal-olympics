import {IComponent} from "../../../../core/IComponent";
import {Entity} from "../../../../core/Entity";
import {Scene} from "../../../../core/Scene";
import * as B from '@babylonjs/core';
import {MeshComponent} from "../../../../core/components/MeshComponent";
import {CameraComponent} from "../../../../core/components/CameraComponent";
import {PlayerBehaviour} from "../PlayerBehaviour";

export class CameraMovement implements IComponent {
    public name: string = "CameraMovement";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private camera!: B.FreeCamera;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        const cameraComponent = this.entity.getComponent("Camera") as CameraComponent;
        this.camera = cameraComponent.camera;
    }

    public onUpdate(): void {
        const players: Entity[] = this.scene.entityManager.getEntitiesWithTag("player");
        if (players.length < 1) return;

        const averagePosition: B.Vector3 = this.getAveragePosition(players);

        // move the camera to the average position of all players
        this.camera.position.x += (averagePosition.x - this.camera.position.x) * 0.1;
    }

    public onFixedUpdate(): void {}

    public onDestroy(): void {}

    private getAveragePosition(players: Entity[]): B.Vector3 {
        let min: B.Vector3 | null = null;
        let max: B.Vector3 | null = null;

        // get the bounding box of all the player entities
        for (let i: number = 0; i < players.length; i++) {
            const playerBehaviour = players[i].getComponent("PlayerBehaviour") as PlayerBehaviour;
            if (playerBehaviour.isStopped) continue;

            const meshComponent = players[i].getComponent("Mesh") as MeshComponent;
            const mesh: B.Mesh = meshComponent.mesh;

            if (!min || !max) {
                min = mesh.getBoundingInfo().boundingBox.minimumWorld;
                max = mesh.getBoundingInfo().boundingBox.maximumWorld;
                continue;
            }

            min = B.Vector3.Minimize(min, mesh.getBoundingInfo().boundingBox.minimumWorld);
            max = B.Vector3.Maximize(max, mesh.getBoundingInfo().boundingBox.maximumWorld);
        }

        if (!min || !max) throw new Error("No players found");

        const boundingBox = new B.BoundingBox(min, max);
        return boundingBox.centerWorld;
    }
}