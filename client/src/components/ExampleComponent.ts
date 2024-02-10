import {IComponent} from "../core/IComponent";
import {Entity} from "../core/Entity";
import {Scene} from "../core/Scene";
import * as B from '@babylonjs/core';
import {MeshComponent} from "./MeshComponent";

export class ExampleComponent implements IComponent {
    public name: string = "Example";
    public entity: Entity;
    public scene: Scene;

    private mesh!: B.Mesh;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this.mesh = meshComponent.mesh;
    }

    public onUpdate(): void {
        this.mesh.position.x += 0.01;
    }

    public onDestroy(): void {}
}
