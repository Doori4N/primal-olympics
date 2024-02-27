import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import {MeshComponent} from "../../core/components/MeshComponent";
import * as B from '@babylonjs/core';

export class MeteoriteBehaviour implements IComponent {
    public name: string = "MeteoriteBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private shadow!: B.SpotLight;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        const groundEntity: Entity = this.scene.entityManager.getFirstEntityWithTag("ground");
        const groundMeshComponent = groundEntity.getComponent("Mesh") as MeshComponent;
        const groundMesh: B.Mesh = groundMeshComponent.mesh;

        const meteoriteMeshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        const meteoriteMesh: B.Mesh = meteoriteMeshComponent.mesh;

        const shadowPosition: B.Vector3 = new B.Vector3(meteoriteMesh.position.x, 1.5, meteoriteMesh.position.z);
        this.shadow = new B.SpotLight(`spotLight${this.entity.id}`, shadowPosition, new B.Vector3(0, -1, 0), Math.PI / 2, 2, this.scene.scene);
        this.shadow.includedOnlyMeshes = [groundMesh];
    }

    public onUpdate(): void {}

    public onDestroy(): void {
        this.shadow.dispose();
    }
}