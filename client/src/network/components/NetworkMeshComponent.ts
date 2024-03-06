import * as B from '@babylonjs/core';
import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import {NetworkHost} from "../NetworkHost";
import {NetworkClient} from "../NetworkClient";
import type {TransformUpdate} from "../types";

export class NetworkMeshComponent implements IComponent {
    public name: string = "NetworkMesh";
    public entity: Entity;
    public scene: Scene;

    // component properties
    public mesh!: B.Mesh;
    public meshRotation!: B.Mesh;

    // event listeners
    private _updateMeshTransformEvent = this._updateMeshTransformClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene, props: {mesh: B.Mesh, useSubMeshForRotation?: boolean}) {
        this.entity = entity;
        this.scene = scene;
        this.mesh = props.mesh;
        this.meshRotation = props.useSubMeshForRotation ? this.mesh.getChildMeshes()[0] as B.Mesh : this.mesh;
    }

    public onStart(): void {
        if (this.scene.game.networkInstance.isHost) return;

        const networkClient = this.scene.game.networkInstance as NetworkClient;
        networkClient.addEventListener(`meshTransform${this.entity.id}`, this._updateMeshTransformEvent);
    }

    public onUpdate(): void {}

    public onTickUpdate(): void {
        if (!this.scene.game.networkInstance.isHost) return;

        const rotation = (this.meshRotation.rotationQuaternion) ? this.meshRotation.rotationQuaternion.toEulerAngles() : this.meshRotation.rotation;

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients(`meshTransform${this.entity.id}`, {
            position: {
                x: this.mesh.position.x,
                y: this.mesh.position.y,
                z: this.mesh.position.z
            },
            rotation: {
                x: rotation.x,
                y: rotation.y,
                z: rotation.z
            }
        } as TransformUpdate);
    }

    public onDestroy(): void {
        if (!this.scene.game.networkInstance.isHost) {
            const networkClient = this.scene.game.networkInstance as NetworkClient;
            networkClient.removeEventListener(`meshTransform${this.entity.id}`, this._updateMeshTransformEvent);
        }

        this.mesh.dispose();
    }

    private _updateMeshTransformClientRpc(transform: TransformUpdate): void {
        this.mesh.position.x = transform.position.x;
        this.mesh.position.y = transform.position.y;
        this.mesh.position.z = transform.position.z;

        this.meshRotation.rotationQuaternion = B.Quaternion.FromEulerAngles(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    }
}