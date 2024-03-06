import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {InputStates} from "../../../core/types";
import {NetworkHost} from "../../../network/NetworkHost";
import {NetworkMeshComponent} from "../../../network/components/NetworkMeshComponent";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _modelMesh!: B.Mesh;
    private _animations: {[key: string]: B.AnimationGroup} = {};
    private _physicsAggregate!: B.PhysicsAggregate;
    private _speed: number = 0.2;
    private _isGameStarted: boolean = false;
    private _isGameFinished: boolean = false;
    private _lastDirection: number = 0;

    // inputs
    public readonly playerId!: string;

    constructor(entity: Entity, scene: Scene, props: {playerId: string, animationGroups: B.AnimationGroup[]}) {
        this.entity = entity;
        this.scene = scene;
        this.playerId = props.playerId;
        this._animations["Idle"] = props.animationGroups[0];
        this._animations["Walking"] = props.animationGroups[2];
    }

    public onStart(): void {
        if (!this.scene.game.networkInstance.isHost) return;

        const networkMeshComponent = this.entity.getComponent("NetworkMesh") as NetworkMeshComponent;
        this._modelMesh = networkMeshComponent.meshRotation;

        const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        this._physicsAggregate = rigidBodyComponent.physicsAggregate;

        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
    }

    public onUpdate(): void {
        if (!this.scene.game.networkInstance.isHost) return;

        if (!this._isGameStarted || this._isGameFinished) return;

        // this._animate();
    }

    public onTickUpdate(): void {
        if (!this.scene.game.networkInstance.isHost) return;

        if (!this._isGameStarted || this._isGameFinished) return;

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        let inputStates: InputStates = (this.playerId === networkHost.playerId) ? this.scene.game.inputs.inputStates : networkHost.playerInputs[this.playerId];

        // apply velocity
        const deltaTime: number = this.scene.game.engine.getDeltaTime();
        const velocity: B.Vector3 = new B.Vector3(inputStates.direction.x, 0, inputStates.direction.y).normalize();
        velocity.scaleInPlace(this._speed * deltaTime);
        this._physicsAggregate.body.setLinearVelocity(velocity);

        // rotate the model
        // set z rotation to 180 degrees cause the imported model is inverted (best solution for now)
        this._modelMesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, this._getDirection(velocity), Math.PI);
    }

    public onDestroy(): void {}

    private _getDirection(velocity: B.Vector3): number {
        if (velocity.equals(B.Vector3.Zero())) {
            return this._lastDirection;
        }
        this._lastDirection = Math.atan2(velocity.z, -velocity.x) - Math.PI / 2;
        return this._lastDirection;
    }

    // private _animate(): void {
    //     const isInputPressed: boolean = this._inputStates.direction.x !== 0 || this._inputStates.direction.y !== 0;
    //     if (isInputPressed && !this._animations["Walking"].isPlaying) {
    //         this._animations["Idle"].stop();
    //         this._animations["Walking"].start(true, 1.0, this._animations["Walking"].from, this._animations["Walking"].to, false);
    //     }
    //     else if (!isInputPressed && !this._animations["Idle"].isPlaying) {
    //         this._animations["Walking"].stop();
    //         this._animations["Idle"].start(true, 1.0, this._animations["Idle"].from, this._animations["Idle"].to, false);
    //     }
    // }

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