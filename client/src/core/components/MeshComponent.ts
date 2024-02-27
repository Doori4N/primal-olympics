import {IComponent} from "../IComponent";
import {Entity} from "../Entity";
import {Scene} from "../Scene";
import * as B from '@babylonjs/core';

export class MeshComponent implements IComponent {
    public name: string = "Mesh";
    public entity: Entity;
    public scene: Scene;

    // component properties
    public mesh!: B.Mesh;

    constructor(entity: Entity, scene: Scene, props: {mesh: B.Mesh}) {
        this.entity = entity;
        this.scene = scene;
        this.mesh = props.mesh;
    }

    public onStart(): void {}

    public onUpdate(): void {}

    public onDestroy(): void {
        this.mesh.dispose();
    }
}