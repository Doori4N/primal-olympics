import * as B from "@babylonjs/core";
import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import {MeshComponent} from "../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../core/components/RigidBodyComponent";
import {TransformUpdate} from "../types";
import {NetworkHost} from "../NetworkHost";

export class NetworkTransformComponent implements IComponent {
    public name: string = "NetworkTransform";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _meshComponent!: MeshComponent;
    private _mesh!: B.Mesh;
    private _rigidBodyComponent!: RigidBodyComponent;
    private _useInterpolation!: boolean;
    private readonly _usePhysics!: boolean;
    private _serverStateBuffer: {transform: TransformUpdate, timestamp: number}[] = [];
    private _serverStateBufferSize: number = 2;

    // event listeners
    private _usePhysicsEvent = this._onServerState.bind(this);

    constructor(entity: Entity, scene: Scene, props: {
        usePhysics?: boolean,
        useInterpolation?: boolean
    }) {
        this.entity = entity;
        this.scene = scene;
        this._useInterpolation = props.useInterpolation ?? true;
        this._usePhysics = props.usePhysics ?? false;
    }

    public onStart(): void {
        this._meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = this._meshComponent.mesh;

        if (this._usePhysics) {
            this._useInterpolation = false;
            this._rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
            this._rigidBodyComponent.setBodyPreStep(false);
        }

        // CLIENT
        if (!this.scene.game.networkInstance.isHost) {
            this.scene.game.networkInstance.addEventListener(`transformUpdate${this.entity.id}`, this._usePhysicsEvent);
        }
    }

    public onUpdate(): void {
        // CLIENT
        if (!this.scene.game.networkInstance.isHost && this._useInterpolation) {
            this._interpolateTransforms();
        }
    }

    public onFixedUpdate(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            this._sendTransformUpdate();
        }
        // CLIENT
        else if (!this._useInterpolation) {
            this._handleClientUpdate();
        }
    }

    public onDestroy(): void {
        if (!this.scene.game.networkInstance.isHost) {
            this.scene.game.networkInstance.removeEventListener(`transformUpdate${this.entity.id}`, this._usePhysicsEvent);
        }
    }

    private _sendTransformUpdate(): void {
        if (!this._mesh.rotationQuaternion) {
            this._mesh.rotationQuaternion = B.Quaternion.FromEulerAngles(this._mesh.rotation.x, this._mesh.rotation.y, this._mesh.rotation.z);
        }

        const transformUpdate = {
            position: {
                x: this._mesh.position.x,
                y: this._mesh.position.y,
                z: this._mesh.position.z,
            },
            rotation: {
                x: this._mesh.rotationQuaternion.x,
                y: this._mesh.rotationQuaternion.y,
                z: this._mesh.rotationQuaternion.z,
                w: this._mesh.rotationQuaternion.w,
            },
        } as TransformUpdate;

        if (this._usePhysics) {
            const velocity: B.Vector3 = this._rigidBodyComponent.physicsAggregate.body.getLinearVelocity();
            transformUpdate.velocity = {
                x: velocity.x,
                y: velocity.y,
                z: velocity.z,
            }
        }

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients(`transformUpdate${this.entity.id}`, transformUpdate);
    }

    private _onServerState(transformUpdate: TransformUpdate): void {
        this._serverStateBuffer.push({transform: transformUpdate, timestamp: Date.now()});
    }

    private _handleClientUpdate(): void {
        // if the buffer is full, empty it
        if (this._serverStateBuffer.length > this._serverStateBufferSize) {
            while (this._serverStateBuffer.length > 1) {
                this._serverStateBuffer.shift();
            }
        }
        if (this._serverStateBuffer.length > 0) {
            const state = this._serverStateBuffer.shift()!;
            this._updateTransform(state.transform);
        }
    }

    private _interpolateTransforms(): void {
        const now: number = Date.now();

        const tickRate: number = 1000 / this.scene.game.tick;
        // get the render timestamp (current time - 1 frame) to interpolate between the two latest transforms
        const renderTimestamp: number = now - tickRate;

        // drop older transforms
        while (this._serverStateBuffer.length >= 2 && this._serverStateBuffer[1].timestamp <= renderTimestamp) {
            this._serverStateBuffer.shift();
        }

        if (this._serverStateBuffer.length < 2
            || this._serverStateBuffer[0].timestamp > renderTimestamp
            || renderTimestamp > this._serverStateBuffer[1].timestamp
        ) return;

        const position0 = this._serverStateBuffer[0].transform.position;
        const position1 = this._serverStateBuffer[1].transform.position;

        // const rotation0 = this._serverStateBuffer[0].transform.rotation;
        const rotation1 = this._serverStateBuffer[1].transform.rotation;

        const elapsedTime: number = renderTimestamp - this._serverStateBuffer[0].timestamp;
        const duration: number = this._serverStateBuffer[1].timestamp - this._serverStateBuffer[0].timestamp;
        const lerpAmount: number = elapsedTime / duration;

        this._mesh.position.x = B.Scalar.Lerp(position0.x, position1.x, lerpAmount);
        this._mesh.position.y = B.Scalar.Lerp(position0.y, position1.y, lerpAmount);
        this._mesh.position.z = B.Scalar.Lerp(position0.z, position1.z, lerpAmount);

        // this.meshRotation.rotationQuaternion = B.Quaternion.Slerp(
        //     B.Quaternion.FromEulerAngles(rotation0.x, rotation0.y, rotation0.z),
        //     B.Quaternion.FromEulerAngles(rotation1.x, rotation1.y, rotation1.z),
        //     lerpAmount
        // );

        this._mesh.rotationQuaternion = B.Quaternion.FromEulerAngles(rotation1.x, rotation1.y, rotation1.z);
    }

    private _updateTransform(transform: TransformUpdate): void {
        this._mesh.position.x = transform.position.x;
        this._mesh.position.y = transform.position.y;
        this._mesh.position.z = transform.position.z;

        this._mesh.rotationQuaternion!.x = transform.rotation.x;
        this._mesh.rotationQuaternion!.y = transform.rotation.y;
        this._mesh.rotationQuaternion!.z = transform.rotation.z;
        this._mesh.rotationQuaternion!.w = transform.rotation.w;

        if (this._usePhysics) {
            const velocity: B.Vector3 = new B.Vector3(transform.velocity!.x, transform.velocity!.y, transform.velocity!.z);
            this._rigidBodyComponent.physicsAggregate.body.setLinearVelocity(velocity);
        }
    }
}