import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {InputStates} from "../../../core/types";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _hitbox!: B.Mesh;
    private _animations: {[key: string]: B.AnimationGroup} = {};
    private _physicsAggregate!: B.PhysicsAggregate;
    private _speed: number = 0.2;
    private _isGameStarted: boolean = false;
    private _isGameFinished: boolean = false;
    private _lastDirection: number = 0;

    // inputs
    public readonly inputIndex!: number;
    private _inputStates!: InputStates;

    constructor(entity: Entity, scene: Scene, props: {inputIndex: number, animationGroups: B.AnimationGroup[]}) {
        this.entity = entity;
        this.scene = scene;
        this.inputIndex = props.inputIndex;
        this._animations["Idle"] = props.animationGroups[0];
        this._animations["Walking"] = props.animationGroups[2];
    }

    public onStart(): void {
        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._hitbox = meshComponent.mesh;

        const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        this._physicsAggregate = rigidBodyComponent.physicsAggregate;

        this._inputStates = this.scene.game.inputs.inputMap[this.inputIndex];

        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
    }

    public onUpdate(): void {
        if (!this._isGameStarted || this._isGameFinished) return;

        // apply velocity
        const deltaTime: number = this.scene.scene.deltaTime ?? 0;
        const velocity: B.Vector3 = new B.Vector3(this._inputStates.direction.x, 0, -this._inputStates.direction.y).normalize();
        velocity.scaleInPlace(this._speed * deltaTime);
        this._physicsAggregate.body.setLinearVelocity(velocity);

        // rotate the model
        const modelMesh: B.Mesh = this._hitbox.getChildMeshes()[0] as B.Mesh;
        // set z rotation to 180 degrees cause the imported model is inverted (best solution for now)
        modelMesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, this._getDirection(velocity), Math.PI);

        // animate
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
        if (isInputPressed && !this._animations["Walking"].isPlaying) {
            this._animations["Idle"].stop();
            this._animations["Walking"].start(true, 1.0, this._animations["Walking"].from, this._animations["Walking"].to, false);
        }
        else if (!isInputPressed && !this._animations["Idle"].isPlaying) {
            this._animations["Walking"].stop();
            this._animations["Idle"].start(true, 1.0, this._animations["Idle"].from, this._animations["Idle"].to, false);
        }
    }

    public kill(): void {
        this.scene.entityManager.destroyEntity(this.entity);
    }

    private _onGameStarted(): void {
        this._isGameStarted = true;
    }

    private _onGameFinished(): void {
        this._isGameFinished = true;
    }
}