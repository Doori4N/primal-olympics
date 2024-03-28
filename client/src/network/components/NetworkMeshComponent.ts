import * as B from '@babylonjs/core';
import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import {NetworkHost} from "../NetworkHost";
import {NetworkClient} from "../NetworkClient";
import {TransformUpdate} from "../types";
import {InputStates} from "../../core/types";

export class NetworkMeshComponent implements IComponent {
    public name: string = "NetworkMesh";
    public entity: Entity;
    public scene: Scene;

    // component properties
    public mesh!: B.Mesh;
    public meshRotation!: B.Mesh;
    private _useInterpolation: boolean = true;
    private _clientPrediction: boolean = false;
    private _transformBuffer: {transform: TransformUpdate, timestamp: number}[] = []; // buffer for interpolation
    private _pendingInputs: InputStates[] = []; // client predicted inputs
    private _serverStateBuffer: {transform: TransformUpdate, tick: number}[] = []; // buffer for reconciliation
    public onApplyInput!: (inputs: InputStates) => void;

    // event listeners
    private _processHostMessageEvent = this._processHostMessage.bind(this);

    constructor(entity: Entity, scene: Scene, props: {
        mesh: B.Mesh,
        useInterpolation?: boolean,
        clientPrediction?: boolean,
        useSubMeshForRotation?: boolean
    }) {
        this.entity = entity;
        this.scene = scene;
        this.mesh = props.mesh;
        this.meshRotation = props.useSubMeshForRotation ? this.mesh.getChildMeshes()[0] as B.Mesh : this.mesh;
        this._useInterpolation = props.useInterpolation ?? true;
        this._clientPrediction = props.clientPrediction ?? false;
    }

    public onStart(): void {
        if (this.scene.game.networkInstance.isHost) return;

        const networkClient = this.scene.game.networkInstance as NetworkClient;
        networkClient.addEventListener(`meshTransformUpdate${this.entity.id}`, this._processHostMessageEvent);
    }

    public onUpdate(): void {
        if (this.scene.game.networkInstance.isHost) return;

        if (this._useInterpolation) this._interpolateTransforms();
    }

    public onFixedUpdate(): void {
        if (!this.scene.game.networkInstance.isHost) {
            this._handleClientUpdate();
            return;
        }

        // if the client does not use prediction, we can send update automatically
        // without having to synchronize it with the client's ticks
        if (!this._clientPrediction) this.sendAuthoritativeTransform(this.scene.game.tickIndex);
    }

    public onDestroy(): void {
        if (!this.scene.game.networkInstance.isHost) {
            const networkClient = this.scene.game.networkInstance as NetworkClient;
            networkClient.removeEventListener(`meshTransformUpdate${this.entity.id}`, this._processHostMessageEvent);
        }

        this.mesh.dispose();
    }

    private _processHostMessage(transform: TransformUpdate, tick: number): void {
        if (this._useInterpolation) {
            this._transformBuffer.push({transform, timestamp: Date.now()});
        }
        else {
            this._serverStateBuffer.push({transform, tick});
        }
    }

    public sendAuthoritativeTransform(tick: number): void {
        const networkHost = this.scene.game.networkInstance as NetworkHost;
        const transform: TransformUpdate = this.getTransformUpdate();
        networkHost.sendToAllClients(`meshTransformUpdate${this.entity.id}`, transform, tick);
    }

    private _interpolateTransforms(): void {
        const now: number = Date.now();

        const tickRate: number = 1000 / this.scene.game.tick;
        // get the render timestamp (current time - 1 frame) to interpolate between the two latest transforms
        const renderTimestamp: number = now - tickRate;

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

    /**
     * Save the input to predict it later
     * @param inputs - the input to predict
     */
    public predict(inputs: InputStates): void {
        this._pendingInputs.push(inputs);
    }

    private _reconciliation(transform: TransformUpdate, tick: number): void {
        this.updateTransform(transform);

        // drop older inputs (already processed)
        while (this._pendingInputs.length > 0 && this._pendingInputs[0].tick <= tick) {
            this._pendingInputs.shift();
        }

        // re-apply pending inputs
        let i: number = 0;
        while (i < this._pendingInputs.length) {
            this.onApplyInput(this._pendingInputs[i]);
            i++;
        }
    }

    private _handleClientUpdate(): void {
        if (this._serverStateBuffer.length > 0) {
            const state = this._serverStateBuffer.shift();
            if (state) {
                this._reconciliation(state.transform, state.tick);
            }
        }
    }

    /**
     * Disable the component updates
     */
    public disable(): void {
        this._useInterpolation = false;
        this._clientPrediction = true;
    }

    /**
     * Update the position and rotation of the mesh
     */
    public updateTransform(transform: TransformUpdate): void {
        this.mesh.position.x = transform.position.x;
        this.mesh.position.y = transform.position.y;
        this.mesh.position.z = transform.position.z;

        this.meshRotation.rotationQuaternion = B.Quaternion.FromEulerAngles(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    }

    public getTransformUpdate(): TransformUpdate {
        const rotation: B.Vector3 = (this.meshRotation.rotationQuaternion) ? this.meshRotation.rotationQuaternion.toEulerAngles() : this.meshRotation.rotation;
        return {
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
        } as TransformUpdate;
    }
}