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

    private readonly _interpolate: boolean;
    private _transformBuffer: {transform: TransformUpdate, timestamp: number}[] = [];

    // event listeners
    private _processHostMessageListener = this._processHostMessage.bind(this);

    constructor(entity: Entity, scene: Scene, props: {mesh: B.Mesh, interpolate?: boolean, useSubMeshForRotation?: boolean}) {
        this.entity = entity;
        this.scene = scene;
        this.mesh = props.mesh;
        this.meshRotation = props.useSubMeshForRotation ? this.mesh.getChildMeshes()[0] as B.Mesh : this.mesh;
        this._interpolate = props.interpolate ?? true;
    }

    public onStart(): void {
        if (this.scene.game.networkInstance.isHost) return;

        const networkClient = this.scene.game.networkInstance as NetworkClient;
        networkClient.addEventListener(`meshTransformUpdate${this.entity.id}`, this._processHostMessageListener);
    }

    public onUpdate(): void {
        if (this.scene.game.networkInstance.isHost) return;

        if (this._interpolate) this._interpolateTransforms();
    }

    public onFixedUpdate(): void {
        if (!this.scene.game.networkInstance.isHost) return;

        const rotation = (this.meshRotation.rotationQuaternion) ? this.meshRotation.rotationQuaternion.toEulerAngles() : this.meshRotation.rotation;

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients(`meshTransformUpdate${this.entity.id}`, {
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
            networkClient.removeEventListener(`meshTransformUpdate${this.entity.id}`, this._processHostMessageListener);
        }

        this.mesh.dispose();
    }

    private _processHostMessage(transform: TransformUpdate): void {
        if (this._interpolate) {
            this._transformBuffer.push({transform, timestamp: Date.now()});
        }
        else {
            this._updateMeshTransform(transform);
        }
    }

    private _interpolateTransforms(): void {
        const now: number = Date.now();

        // get the render timestamp (current time - 1 frame) to interpolate between the two latest transforms
        const renderTimestamp: number = now - this.scene.game.tickRate;

        // drop older transforms
        while (this._transformBuffer.length >= 2 && this._transformBuffer[1].timestamp <= renderTimestamp) {
            this._transformBuffer.shift();
        }

        if (this._transformBuffer.length < 2
            || this._transformBuffer[0].timestamp > renderTimestamp
            || renderTimestamp > this._transformBuffer[1].timestamp
        ) return;

        const position0 = this._transformBuffer[0].transform.position;
        const position1 = this._transformBuffer[1].transform.position;

        // const rotation0 = this._transformBuffer[0].transform.rotation;
        const rotation1 = this._transformBuffer[1].transform.rotation;

        const elapsedTime: number = renderTimestamp - this._transformBuffer[0].timestamp;
        const duration: number = this._transformBuffer[1].timestamp - this._transformBuffer[0].timestamp;
        const lerpAmount: number = elapsedTime / duration;

        this.mesh.position.x = B.Scalar.Lerp(position0.x, position1.x, lerpAmount);
        this.mesh.position.y = B.Scalar.Lerp(position0.y, position1.y, lerpAmount);
        this.mesh.position.z = B.Scalar.Lerp(position0.z, position1.z, lerpAmount);

        // this.meshRotation.rotationQuaternion = B.Quaternion.Slerp(
        //     B.Quaternion.FromEulerAngles(rotation0.x, rotation0.y, rotation0.z),
        //     B.Quaternion.FromEulerAngles(rotation1.x, rotation1.y, rotation1.z),
        //     lerpAmount
        // );

        this.meshRotation.rotationQuaternion = B.Quaternion.FromEulerAngles(rotation1.x, rotation1.y, rotation1.z);
    }

    private _updateMeshTransform(transform: TransformUpdate): void {
        this.mesh.position.x = transform.position.x;
        this.mesh.position.y = transform.position.y;
        this.mesh.position.z = transform.position.z;

        this.meshRotation.rotationQuaternion = B.Quaternion.FromEulerAngles(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    }
}