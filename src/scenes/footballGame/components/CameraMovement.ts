import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {Utils} from "../../../utils/Utils";
import {CameraComponent} from "../../../core/components/CameraComponent";

export class CameraMovement implements IComponent {
    public name: string = "CameraMovement";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _camera!: B.FreeCamera;
    private _cameraSpeed: number = 0.03;
    private _limitX: number = 10;
    private _limitZ: number = 6;
    private _offsetZ: number = 17;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        const cameraComponent = this.entity.getComponent("Camera") as CameraComponent;
        this._camera = cameraComponent.camera;
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        const ballEntity: Entity | null = this.scene.entityManager.getFirstEntityByTag("ball");
        if (!ballEntity) return;

        const meshComponent = ballEntity.getComponent("Mesh") as MeshComponent;
        const ballMesh: B.Mesh = meshComponent.mesh;

        const newPosX: number = Utils.lerp(this._camera.position.x, ballMesh.position.x, this._cameraSpeed);
        if (newPosX > -this._limitX && newPosX < this._limitX) {
            this._camera.position.x = newPosX;
        }

        const newPosZ: number = Utils.lerp(this._camera.position.z, ballMesh.position.z - this._offsetZ, this._cameraSpeed);
        if (newPosZ > -this._offsetZ - this._limitZ + 2 && newPosZ < this._limitZ - this._offsetZ) {
            this._camera.position.z = newPosZ;
        }
    }

    public onDestroy(): void {}
}