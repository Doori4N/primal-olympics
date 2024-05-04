import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {BallBehaviour} from "./BallBehaviour";
import {MeshComponent} from "../../../core/components/MeshComponent";

export class EdgeCollision implements IComponent {
    public name: string = "EdgeCollision";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _edgeCollisionObserver!: B.Observer<B.IPhysicsCollisionEvent>;
    private _mesh!: B.Mesh;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = meshComponent.mesh;

        const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        if (this.scene.game.networkInstance.isHost) {
            this._edgeCollisionObserver = rigidBodyComponent.collisionObservable.add(this._onCollision.bind(this));
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) this._edgeCollisionObserver.remove();
    }

    private _onCollision(event: B.IPhysicsCollisionEvent): void {
        if (event.type !== B.PhysicsEventType.COLLISION_STARTED) return;

        const collidedAgainst: B.TransformNode = event.collidedAgainst.transformNode;

        if (collidedAgainst.metadata?.tag === "ball") {
            const ballEntity: Entity = this.scene.entityManager.getEntityById(collidedAgainst.metadata.id);
            const ballBehaviourComponent = ballEntity.getComponent("BallBehaviour") as BallBehaviour;

            // if the ball has an owner, don't do anything
            if (ballBehaviourComponent.getOwner()) return;

            const normal: B.Vector3 = this._mesh.forward.normalize();
            const reflection: B.Vector3 = B.Vector3.Reflect(ballBehaviourComponent.getVelocity(), normal);

            ballBehaviourComponent.setVelocity(reflection);
            ballBehaviourComponent.rotateBall(B.Quaternion.FromEulerAngles(0, Math.atan2(reflection.z, -reflection.x) - Math.PI / 2, 0));
        }
    }
}