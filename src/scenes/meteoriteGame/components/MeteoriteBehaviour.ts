import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {MeshComponent} from "../../../core/components/MeshComponent";
import * as B from '@babylonjs/core';
import {Utils} from "../../../utils/Utils";

const MIN_HEIGHT: number = 10;

export class MeteoriteBehaviour implements IComponent {
    public name: string = "MeteoriteBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _shadow!: B.Mesh;
    private _meteoriteMesh!: B.Mesh;
    private readonly _shadowMaterial!: B.StandardMaterial;

    constructor(entity: Entity, scene: Scene, props: {shadowMaterial: B.StandardMaterial}) {
        this.entity = entity;
        this.scene = scene;
        this._shadowMaterial = props.shadowMaterial;
    }

    public onStart(): void {
        const meteoriteMeshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._meteoriteMesh = meteoriteMeshComponent.mesh;

        const shadowPosition: B.Vector3 = new B.Vector3(this._meteoriteMesh.position.x, 0, this._meteoriteMesh.position.z);
        this._shadow = B.MeshBuilder.CreateDisc("shadow", {radius: 1.5, tessellation: 0}, this.scene.babylonScene);
        this._shadow.position = shadowPosition;
        this._shadow.rotation.x = Math.PI / 2;
        this._shadow.scaling.x = MIN_HEIGHT / this._meteoriteMesh.position.y;
        this._shadow.scaling.y = MIN_HEIGHT / this._meteoriteMesh.position.y;

        // color
        this._shadow.material = this._shadowMaterial;
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        this._scaleShadow();

        if (!this.scene.game.networkInstance.isHost) return;

        // HOST
        this._meteoriteMesh.rotate(B.Axis.X, 0.03, B.Space.WORLD);
    }

    public onDestroy(): void {
        this._shadow.dispose();
    }

    private _scaleShadow(): void {
        let scale: number;
        if (this._meteoriteMesh.position.y <= MIN_HEIGHT) scale = 1;
        else scale = MIN_HEIGHT / this._meteoriteMesh.position.y;
        this._shadow.scaling.x = Utils.lerp(this._shadow.scaling.x, scale, .1);
        this._shadow.scaling.y = Utils.lerp(this._shadow.scaling.y, scale, .1);
    }
}