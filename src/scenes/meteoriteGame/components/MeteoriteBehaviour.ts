import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {MeshComponent} from "../../../core/components/MeshComponent";
import * as B from '@babylonjs/core';

export class MeteoriteBehaviour implements IComponent {
    public name: string = "MeteoriteBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _shadow!: B.Mesh;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        const meteoriteMeshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        const meteoriteMesh: B.Mesh = meteoriteMeshComponent.mesh;

        const shadowPosition: B.Vector3 = new B.Vector3(meteoriteMesh.position.x, 0, meteoriteMesh.position.z);
        this._shadow = B.MeshBuilder.CreateDisc("shadow", {radius: 1.5, tessellation: 0}, this.scene.babylonScene);
        this._shadow.position = shadowPosition;
        this._shadow.rotation.x = Math.PI / 2;

        // color
        const shadowMaterial = new B.StandardMaterial("shadowMat", this.scene.babylonScene);
        shadowMaterial.diffuseColor = new B.Color3(0.2, 0.2, 0.2);
        this._shadow.material = shadowMaterial;
        this._shadow.material.zOffset = -1;
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        this._shadow.dispose();
    }
}