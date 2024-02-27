import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import * as B from "@babylonjs/core";
import {MeshComponent} from "../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../core/components/RigidBodyComponent";
import {InputStates} from "../../core/types";
import {lerp} from "../../utils/utils";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private mesh!: B.Mesh;
    private animations: {[key: string]: B.AnimationGroup} = {};
    private physicsAggregate!: B.PhysicsAggregate;
    private speed: number = 0.2;
    private lastDirection: number = 0;
    private isGameStarted: boolean = false;
    private isGameFinished: boolean = false;

    // inputs
    public readonly inputIndex!: number;
    private inputStates!: InputStates;

    constructor(entity: Entity, scene: Scene, props: {inputIndex: number, animationGroups: B.AnimationGroup[]}) {
        this.entity = entity;
        this.scene = scene;
        this.inputIndex = props.inputIndex;
        this.animations["Idle"] = props.animationGroups[0];
        this.animations["Walking"] = props.animationGroups[2];
    }

    public onStart(): void {
        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this.mesh = meshComponent.mesh;

        const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        this.physicsAggregate = rigidBodyComponent.physicsAggregate;

        this.inputStates = this.scene.game.inputs.inputMap[this.inputIndex];

        this.scene.eventManager.subscribe("onGameStarted", this.onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this.onGameFinished.bind(this));
    }

    public onUpdate(): void {
        if (!this.isGameStarted || this.isGameFinished) return;

        // apply velocity
        const deltaTime: number = this.scene.scene.deltaTime ?? 0;
        const velocity: B.Vector3 = new B.Vector3(-this.inputStates.direction.x, 0, -this.inputStates.direction.y).normalize();
        velocity.scaleInPlace(this.speed * deltaTime);
        this.physicsAggregate.body.setLinearVelocity(velocity);

        // rotate the model
        const modelMesh: B.Mesh = this.mesh.getChildMeshes()[0] as B.Mesh;
        console.log(modelMesh.rotation.y, this.getDirection(velocity));
        modelMesh.rotation.y = lerp(modelMesh.rotation.y, this.getDirection(velocity), 1);

        // animate
        this.animate();
    }

    public onDestroy(): void {}

    private getDirection(velocity: B.Vector3): number {
        if (velocity.equals(B.Vector3.Zero())) {
            return this.lastDirection;
        }
        this.lastDirection = Math.atan2(velocity.z, -velocity.x) - Math.PI / 2;
        return this.lastDirection;
    }

    private animate(): void {
        const isInputPressed: boolean = this.inputStates.direction.x !== 0 || this.inputStates.direction.y !== 0;
        if (isInputPressed && !this.animations["Walking"].isPlaying) {
            this.animations["Idle"].stop();
            this.animations["Walking"].start(true, 1.0, this.animations["Walking"].from, this.animations["Walking"].to, false);
        }
        else if (!isInputPressed && !this.animations["Idle"].isPlaying) {
            this.animations["Walking"].stop();
            this.animations["Idle"].start(true, 1.0, this.animations["Idle"].from, this.animations["Idle"].to, false);
        }
    }

    public kill(): void {
        this.scene.entityManager.destroyEntity(this.entity);
    }

    private onGameStarted(): void {
        this.isGameStarted = true;
    }

    private onGameFinished(): void {
        this.isGameFinished = true;
    }
}