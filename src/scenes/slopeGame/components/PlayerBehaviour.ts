import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";
import {NetworkPredictionComponent} from "../../../network/components/NetworkPredictionComponent";
import {InputStates} from "../../../core/types";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {NetworkHost} from "../../../network/NetworkHost";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    public readonly playerId: string;
    private readonly _isOwner: boolean; // is the player the owner of the entity
    protected _isGameStarted: boolean = false;
    protected _isGameFinished: boolean = false;
    private _networkAnimationComponent!: NetworkAnimationComponent;
    private _networkPredictionComponent!: NetworkPredictionComponent<InputStates>;
    private _physicsAggregate!: B.PhysicsAggregate;
    private _playerCollisionObserver!: B.Observer<B.IPhysicsCollisionEvent>;
    private _mesh!: B.Mesh;
    private _canJump: boolean = true;

    // movement
    private _speed: number = 5;
    private _velocity: B.Vector3 = B.Vector3.Zero();

    constructor(entity: Entity, scene: Scene, props: {playerId: string}) {
        this.entity = entity;
        this.scene = scene;
        this.playerId = props.playerId;
        this._isOwner = this.scene.game.networkInstance.playerId === this.playerId;
    }

    public onStart(): void {
        this._networkPredictionComponent = this.entity.getComponent("NetworkPrediction") as NetworkPredictionComponent<InputStates>;
        this._networkPredictionComponent.onApplyInput.add(this._applyPredictedInput.bind(this));

        this._networkAnimationComponent = this.entity.getComponent("NetworkAnimation") as NetworkAnimationComponent;
        this._networkAnimationComponent.startAnimation("Idle");

        const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        this._physicsAggregate = rigidBodyComponent.physicsAggregate;
        if (this.scene.game.networkInstance.isHost) {
            this._playerCollisionObserver = rigidBodyComponent.collisionObservable.add(this._onCollision.bind(this));
        }

        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = meshComponent.mesh;

        // subscribe to game events
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this._isGameStarted || this._isGameFinished) return;
        if (this.scene.game.networkInstance.isHost) this._handleServerUpdate();
        else this._handleClientUpdate();
    }

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) this._playerCollisionObserver.remove();
    }

    private _handleServerUpdate(): void {
        if (this._isOwner) {
            const inputStates: InputStates = this.scene.game.inputManager.inputStates;
            this._processInputStates(inputStates);
            this._networkPredictionComponent.sendTransformUpdate(inputStates.tick, this._velocity.clone());
        }
        else {
            const inputs: InputStates[] = this.scene.game.networkInputManager.getPlayerInput(this.playerId);
            for (let i: number = 0; i < inputs.length; i++) {
                const inputStates: InputStates = inputs[i];
                this._processInputStates(inputStates);
                this._networkPredictionComponent.sendTransformUpdate(inputStates.tick, this._velocity.clone());
                // don't simulate the last input because it will be simulated automatically in this frame
                if (i < inputs.length - 1) {
                    this.scene.simulate([this._physicsAggregate.body]);
                }
            }
        }
    }

    private _handleClientUpdate(): void {
        const inputStates: InputStates = this.scene.game.inputManager.cloneInputStates(this.scene.game.inputManager.inputStates);

        // client prediction
        if (this._isOwner) {
            this._processInputStates(inputStates);
            this._networkPredictionComponent.predict(inputStates, inputStates.tick);
        }
    }

    private _processInputStates(inputStates: InputStates): void {
        this._movePlayer(inputStates);
        this._animate(inputStates);
    }

    private _animate(inputStates: InputStates): void {
        const isInputPressed: boolean = inputStates.direction.x !== 0 || inputStates.direction.y !== 0;
        if (isInputPressed) {
            this._networkAnimationComponent.startAnimation("Running", {loop: true, transitionSpeed: 0.12});
        }
        else {
            this._networkAnimationComponent.startAnimation("Idle", {loop: true});
        }
    }

    /**
     * Set the linear velocity of the player according to his inputs
     */
    private _movePlayer(inputs: InputStates): void {
        this._velocity = new B.Vector3(inputs.direction.x, 0, inputs.direction.y).normalize();
        this._velocity.scaleInPlace(this._speed);
        this._physicsAggregate.body.setLinearVelocity(this._velocity);

        // rotate mesh
        if (!this._velocity.equals(B.Vector3.Zero())) {
            const rotationY: number = Math.atan2(this._velocity.z, -this._velocity.x) - Math.PI / 2;
            this._mesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, rotationY, 0);
        }
    }

    /**
     * Re-apply the predicted input and simulate physics
     */
    private _applyPredictedInput(inputs: InputStates): void {
        this._movePlayer(inputs);
        this.scene.simulate([this._physicsAggregate.body]);
    }

    private _onCollision(event: B.IPhysicsCollisionEvent): void {
        if (event.type !== B.PhysicsEventType.COLLISION_CONTINUED) return;

        const collidedAgainst: B.TransformNode = event.collidedAgainst.transformNode;

        // handle collision with ground
        if (collidedAgainst.metadata.tag === "slope") {
            this._canJump = true;
        }
        else if (collidedAgainst.metadata.tag === "fallingObject") {
            this.kill();
        }
    }

    public kill(): void {
        this.scene.entityManager.removeEntity(this.entity);
        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients("onDestroyPlayer", {entityId: this.entity.id});
    }

    private _onGameStarted(): void {
        this._isGameStarted = true;
    }

    private _onGameFinished(): void {
        this._isGameFinished = true;
    }
}