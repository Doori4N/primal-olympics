import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {InputStates} from "../../../core/types";
import {NetworkHost} from "../../../network/NetworkHost";
import {NetworkMeshComponent} from "../../../network/components/NetworkMeshComponent";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";
import {NetworkRigidBodyComponent} from "../../../network/components/NetworkRigidBodyComponent";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _modelMesh!: B.Mesh;
    private _physicsAggregate!: B.PhysicsAggregate;
    private _networkRigidBodyComponent!: NetworkRigidBodyComponent;
    private _networkMeshComponent!: NetworkMeshComponent;
    private networkAnimationComponent!: NetworkAnimationComponent;
    private _isGameStarted: boolean = false;
    private _isGameFinished: boolean = false;
    private _speed: number = 4.5;
    private _lastDirection: number = 0;
    private readonly _isOwner!: boolean; // is the player the owner of the entity

    // inputs
    public readonly playerId!: string;
    private _inputStates!: InputStates;

    constructor(entity: Entity, scene: Scene, props: {playerId: string}) {
        this.entity = entity;
        this.scene = scene;
        this.playerId = props.playerId;
        this._isOwner = this.scene.game.networkInstance.playerId === this.playerId;
    }

    public onStart(): void {
        if (!this.scene.game.networkInstance.isHost && !this._isOwner) return;

        // network mesh component
        this._networkMeshComponent = this.entity.getComponent("NetworkMesh") as NetworkMeshComponent;
        this._modelMesh = this._networkMeshComponent.meshRotation;

        // network rigid body component
        this._networkRigidBodyComponent = this.entity.getComponent("NetworkRigidBody") as NetworkRigidBodyComponent;
        this._physicsAggregate = this._networkRigidBodyComponent.physicsAggregate;
        this._networkRigidBodyComponent.onApplyInput = this._applyInput.bind(this);

        this.networkAnimationComponent = this.entity.getComponent("NetworkAnimation") as NetworkAnimationComponent;

        // subscribe to game events
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this.scene.game.networkInstance.isHost && !this._isOwner) return;
        if (!this._isGameStarted || this._isGameFinished) return;

        this._setInputStates();

        const velocity: B.Vector3 = this._movePlayer(this._inputStates);

        // rotate the model
        // set z rotation to 180 degrees cause the imported model is inverted (best solution for now)
        this._modelMesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, this._getDirection(velocity), Math.PI);

        // client prediction
        if (this._isOwner && !this.scene.game.networkInstance.isHost) {
            const inputs: InputStates = this.scene.game.inputManager.cloneInputStates(this._inputStates);
            this._networkRigidBodyComponent.predict(inputs);
        }
        // send authoritative physics
        if (this.scene.game.networkInstance.isHost) {
            this._networkRigidBodyComponent.sendAuthoritativePhysics(this._inputStates.tick, velocity.clone());
        }

        this._animate();
    }

    public onDestroy(): void {}

    /**
     * Get the direction of where the player is moving
     */
    private _getDirection(velocity: B.Vector3): number {
        if (velocity.equals(B.Vector3.Zero())) {
            return this._lastDirection;
        }
        this._lastDirection = Math.atan2(velocity.z, -velocity.x) - Math.PI / 2;
        return this._lastDirection;
    }

    private _animate(): void {
        const isInputPressed: boolean = this._inputStates.direction.x !== 0 || this._inputStates.direction.y !== 0;
        if (isInputPressed) {
            this.networkAnimationComponent.startAnimation("Walking");
        }
        else {
            this.networkAnimationComponent.startAnimation("Idle");
        }
    }

    public kill(): void {
        this.scene.entityManager.destroyEntity(this.entity);
        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients("onDestroyPlayer", {entityId: this.entity.id});
    }

    private _onGameStarted(): void {
        this._isGameStarted = true;
    }

    private _onGameFinished(): void {
        this._isGameFinished = true;
    }

    private _setInputStates(): void {
        // set input states based on the player
        if (this._isOwner) {
            this._inputStates = this.scene.game.inputManager.inputStates;
        }
        else if (this.scene.game.networkInstance.isHost) {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            this._inputStates = networkHost.getPlayerInput(this.playerId);
        }
    }

    /**
     * Re-apply the predicted input and simulate the physics
     */
    private _applyInput(inputs: InputStates): void {
        this._movePlayer(inputs);
        this._networkRigidBodyComponent.simulate();
    }

    private _movePlayer(inputs: InputStates): B.Vector3 {
        let velocity: B.Vector3 = new B.Vector3(inputs.direction.x, 0, inputs.direction.y).normalize();
        velocity.scaleInPlace(this._speed);
        this._physicsAggregate.body.setLinearVelocity(velocity);
        return velocity;
    }
}