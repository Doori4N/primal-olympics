import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {InputStates} from "../../../core/types";
import {NetworkHost} from "../../../network/NetworkHost";
import {NetworkMeshComponent} from "../../../network/components/NetworkMeshComponent";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _modelMesh!: B.Mesh;
    private _physicsAggregate!: B.PhysicsAggregate;
    private _speed: number = 3;
    private _isGameStarted: boolean = false;
    private _isGameFinished: boolean = false;
    private _lastDirection: number = 0;
    private networkAnimationComponent!: NetworkAnimationComponent;

    // inputs
    public readonly playerId!: string;
    private _inputStates!: InputStates;

    constructor(entity: Entity, scene: Scene, props: {playerId: string}) {
        this.entity = entity;
        this.scene = scene;
        this.playerId = props.playerId;
    }

    public onStart(): void {
        if (!this.scene.game.networkInstance.isHost) return;

        const networkMeshComponent = this.entity.getComponent("NetworkMesh") as NetworkMeshComponent;
        this._modelMesh = networkMeshComponent.meshRotation;

        const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        this._physicsAggregate = rigidBodyComponent.physicsAggregate;

        this.networkAnimationComponent = this.entity.getComponent("NetworkAnimation") as NetworkAnimationComponent;

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        this._inputStates = (this.playerId === networkHost.playerId) ? this.scene.game.inputs.inputStates : networkHost.playerInputs[this.playerId];

        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this.scene.game.networkInstance.isHost) return;

        if (!this._isGameStarted || this._isGameFinished) return;

        // apply velocity
        const velocity: B.Vector3 = new B.Vector3(this._inputStates.direction.x, 0, this._inputStates.direction.y).normalize();
        velocity.scaleInPlace(this._speed);
        this._physicsAggregate.body.setLinearVelocity(velocity);

        // rotate the model
        // set z rotation to 180 degrees cause the imported model is inverted (best solution for now)
        this._modelMesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, this._getDirection(velocity), Math.PI);

        this._animate();
    }

    public onDestroy(): void {}

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
}