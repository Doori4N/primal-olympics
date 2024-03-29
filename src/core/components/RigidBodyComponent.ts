import {IComponent} from "../IComponent";
import {Entity} from "../Entity";
import {Scene} from "../Scene";
import * as B from '@babylonjs/core';
import {MeshComponent} from "./MeshComponent";

export class RigidBodyComponent implements IComponent {
    public name: string = "RigidBody";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private readonly mesh!: B.Mesh;
    public physicsAggregate!: B.PhysicsAggregate;
    public collisionObservable!: B.Observable<B.IPhysicsCollisionEvent>;

    /**
     * @throws Error if entity does not have a MeshComponent
     */
    constructor(entity: Entity, scene: Scene, props:
        {
            physicsShape: B.PhysicsShapeType | B.PhysicsShape,
            physicsProps: B.PhysicsAggregateParameters,
            isTrigger?: boolean,
            isCallbackEnabled?: boolean,
            massProps?: B.PhysicsMassProperties
        })
    {
        this.entity = entity;
        this.scene = scene;

        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this.mesh = meshComponent.mesh;

        this.createPhysicsAggregate(props.physicsShape, props.physicsProps, props.massProps);

        if (props.isTrigger) {
            this.physicsAggregate.shape.isTrigger = true;
        }

        if (props.isCallbackEnabled) {
            const body: B.PhysicsBody = this.physicsAggregate.body;
            body.setCollisionCallbackEnabled(true);
            this.collisionObservable = body.getCollisionObservable();
        }
    }

    public onStart(): void {}

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        this.physicsAggregate.dispose();
    }

    private createPhysicsAggregate(
        physicsShape: B.PhysicsShapeType | B.PhysicsShape,
        physicsProps: B.PhysicsAggregateParameters,
        massProps: B.PhysicsMassProperties | undefined
    ): void {
        // disable collisions on the mesh and use physics engine for collisions
        this.mesh.checkCollisions = false;

        this.physicsAggregate = new B.PhysicsAggregate(this.mesh, physicsShape, physicsProps, this.scene.scene);

        if (massProps) {
            this.physicsAggregate.body.setMassProperties(massProps);
        }
    }
}