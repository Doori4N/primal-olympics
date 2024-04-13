import * as B from "@babylonjs/core";
import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import {NetworkHost} from "../NetworkHost";
import {TransformUpdate} from "../types";
import {MeshComponent} from "../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../core/components/RigidBodyComponent";

export class NetworkPredictionComponent<T> implements IComponent {
    public name: string = "NetworkPrediction";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _mesh!: B.Mesh;
    private _meshComponent!: MeshComponent;
    private readonly _usePhysics!: boolean;
    private _rigidBodyComponent!: RigidBodyComponent;
    private _serverStateBuffer: {transform: TransformUpdate, tick: number}[] = [];
    private _serverStateBufferSize: number = 2;
    private _pendingInputs: {inputs: T, tick: number}[] = []; // client predicted inputs
    public onApplyInput= new B.Observable<T>();

    // event listeners
    private _updatePhysicsEvent = this._onServerState.bind(this);

    constructor(entity: Entity, scene: Scene, props: {
        usePhysics?: boolean
    }) {
        this.entity = entity;
        this.scene = scene;
        this._usePhysics = props.usePhysics ?? false;
    }

    public onStart(): void {
        this._meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = this._meshComponent.mesh;

        if (this._usePhysics) {
            this._rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
            this._rigidBodyComponent.setBodyPreStep(false);
        }

        // CLIENT
        if (!this.scene.game.networkInstance.isHost) {
            this.scene.game.networkInstance.addEventListener(`transformUpdate${this.entity.id}`, this._updatePhysicsEvent);
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        // CLIENT
        if (!this.scene.game.networkInstance.isHost) {
            this._handleClientUpdate();
        }
    }

    public onDestroy(): void {
        this.onApplyInput.clear();

        // CLIENT
        if (!this.scene.game.networkInstance.isHost) {
            this.scene.game.networkInstance.removeEventListener(`transformUpdate${this.entity.id}`, this._updatePhysicsEvent);
        }
    }

    public predict(inputs: T, tick: number): void {
        this._pendingInputs.push({inputs, tick});
    }

    public sendTransformUpdate(tick: number, velocity?: B.Vector3): void {
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
            const _velocity: B.Vector3 = velocity ?? this._rigidBodyComponent.physicsAggregate.body.getLinearVelocity();
            transformUpdate.velocity = {
                x: _velocity.x,
                y: _velocity.y,
                z: _velocity.z,
            }
        }

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients(`transformUpdate${this.entity.id}`, transformUpdate, tick);
    }

    private _reconciliation(transform: TransformUpdate, tick: number): void {
        this._updateTransform(transform);

        // drop older inputs (already processed)
        while (this._pendingInputs.length > 0 && this._pendingInputs[0].tick <= tick) {
            this._pendingInputs.shift();
        }

        // re-apply pending inputs
        let i: number = 0;
        while (i < this._pendingInputs.length) {
            this.onApplyInput.notifyObservers(this._pendingInputs[i].inputs);
            i++;
        }
    }

    private _onServerState(transform: TransformUpdate, tick: number): void {
        this._serverStateBuffer.push({transform, tick});
    }

    private _handleClientUpdate(): void {
        // if the buffer is full, empty it
        if (this._serverStateBuffer.length > this._serverStateBufferSize) {
            while (this._serverStateBuffer.length > 0) {
                const state = this._serverStateBuffer.shift()!;
                this._reconciliation(state.transform, state.tick);
            }
        }
        else {
            if (this._serverStateBuffer.length > 0) {
                const state = this._serverStateBuffer.shift()!;
                this._reconciliation(state.transform, state.tick);
            }
        }
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
            this.scene.simulate([this._rigidBodyComponent.physicsAggregate.body]);
        }
    }
}