import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import * as B from "@babylonjs/core";
import {NetworkMeshComponent} from "./NetworkMeshComponent";
import {NetworkHost} from "../NetworkHost";
import {PhysicsUpdate, TransformUpdate} from "../types";
import {InputStates} from "../../core/types";

/**
 * [REQUIRED] NetworkMeshComponent
 */
export class NetworkRigidBodyComponent implements IComponent {
    public name: string = "NetworkRigidBody";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _mesh!: B.Mesh;
    private _props;
    public physicsAggregate!: B.PhysicsAggregate;
    public collisionObservable!: B.Observable<B.IPhysicsCollisionEvent>;
    private _networkMeshComponent!: NetworkMeshComponent;
    private _clientPrediction: boolean = false;
    private _pendingInputs: InputStates[] = []; // client predicted inputs
    private _serverStateBuffer: {physics: PhysicsUpdate, tick: number}[] = [];
    public onApplyInput!: (inputs: InputStates) => void;

    // event listeners
    private _updatePhysicsEvent = this._onServerState.bind(this);

    /**
     * @throws Error if entity does not have a MeshComponent
     */
    constructor(entity: Entity, scene: Scene, props:
        {
            physicsShape: B.PhysicsShapeType | B.PhysicsShape,
            physicsProps: B.PhysicsAggregateParameters,
            isTrigger?: boolean,
            isCallbackEnabled?: boolean,
            massProps?: B.PhysicsMassProperties,
            clientPrediction?: boolean
        })
    {
        this.entity = entity;
        this.scene = scene;
        this._props = props;
    }

    public onStart(): void {
        this._networkMeshComponent = this.entity.getComponent("NetworkMesh") as NetworkMeshComponent;
        this._mesh = this._networkMeshComponent.mesh;
        this._networkMeshComponent.disable();

        this._createPhysicsAggregate(this._props.physicsShape, this._props.physicsProps, this._props.massProps);

        if (this._props.isTrigger) {
            this.physicsAggregate.shape.isTrigger = true;
        }

        if (this._props.isCallbackEnabled) {
            const body: B.PhysicsBody = this.physicsAggregate.body;
            body.setCollisionCallbackEnabled(true);
            this.collisionObservable = body.getCollisionObservable();
        }

        if (this.scene.game.networkInstance.isHost) {
            this._clientPrediction = this._props.clientPrediction ?? false;
        }
        else {
            this.scene.game.networkInstance.addEventListener(`physicsUpdate${this.entity.id}`, this._updatePhysicsEvent);
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        // CLIENT
        if (!this.scene.game.networkInstance.isHost) {
            this._handleClientUpdate();
            return;
        }
        // HOST
        // if the client does not use prediction, we can send update automatically
        // here the tickIndex does not matter, we just want to send the physics update
        if (!this._clientPrediction) this.sendAuthoritativePhysics(this.scene.game.tickIndex, this.physicsAggregate.body.getLinearVelocity());
    }

    public onDestroy(): void {
        this.physicsAggregate.dispose();

        if (!this.scene.game.networkInstance.isHost) {
            this.scene.game.networkInstance.removeEventListener(`physicsUpdate${this.entity.id}`, this._updatePhysicsEvent);
        }
    }

    private _createPhysicsAggregate(physicsShape: B.PhysicsShapeType | B.PhysicsShape, physicsProps: B.PhysicsAggregateParameters, massProps: B.PhysicsMassProperties | undefined): void {
        // disable collisions on the mesh and use physics engine for collisions
        this._mesh.checkCollisions = false;

        this.physicsAggregate = new B.PhysicsAggregate(this._mesh, physicsShape, physicsProps, this.scene.scene);

        // enable pre-step so we can still update position of the mesh with the TransformNode
        this.physicsAggregate.body.disablePreStep = false;

        if (massProps) {
            this.physicsAggregate.body.setMassProperties(massProps);
        }
    }

    /**
     * Save the input to predict it later
     * @param inputs - the input to predict
     */
    public predict(inputs: InputStates): void {
        this._pendingInputs.push(inputs);
    }

    /**
     * Send authoritative physics of this mesh to all clients
     * @param tick - the tick of the update
     * @param linearVelocity - the authoritative linear velocity of the mesh
     */
    public sendAuthoritativePhysics(tick: number, linearVelocity: B.Vector3): void {
        const networkHost = this.scene.game.networkInstance as NetworkHost;
        const transform: TransformUpdate = this._networkMeshComponent.getTransformUpdate();
        networkHost.sendToAllClients(`physicsUpdate${this.entity.id}`,
            {
                linearVelocity: {
                    x: linearVelocity.x,
                    y: linearVelocity.y,
                    z: linearVelocity.z
                },
                transform: transform,
            } as PhysicsUpdate,
            tick);
    }

    /**
     * Corrects mesh transform and physics and applies pending inputs
     * @param physics - the physics update from the server
     * @param tick - the tick of the update to reconcile
     */
    private _reconciliation(physics: PhysicsUpdate, tick: number): void {
        this._networkMeshComponent.updateTransform(physics.transform);

        const linearVelocity: B.Vector3 = new B.Vector3(physics.linearVelocity.x, physics.linearVelocity.y, physics.linearVelocity.z);
        this.physicsAggregate.body.setLinearVelocity(linearVelocity);
        this.simulate();

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

    /**
     * Simulate one physics step for this physics body
     */
    public simulate(): void {
        this.scene.game.physicsPlugin.executeStep(1 / 60, [this.physicsAggregate.body]);
    }

    private _onServerState(physics: PhysicsUpdate, tick: number): void {
        this._serverStateBuffer.push({physics, tick});
    }

    private _handleClientUpdate(): void {
        if (this._serverStateBuffer.length > 0) {
            const state = this._serverStateBuffer.shift();
            if (state) {
                this._reconciliation(state.physics, state.tick);
            }
        }
    }
}
