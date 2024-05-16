import { Entity } from "../../../core/Entity";
import { IComponent } from "../../../core/IComponent";
import { Scene } from "../../../core/Scene";

export class FallingObjectBehaviour implements IComponent {
    public name: string = "FallingObjectBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    onStart(): void {}

    onUpdate(): void {}

    onFixedUpdate(): void {}

    onDestroy(): void {}
}