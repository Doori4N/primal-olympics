import {IComponent} from "../core/IComponent";
import {Entity} from "../core/Entity";
import {Scene} from "../core/Scene";
import * as B from '@babylonjs/core';
import {MeshComponent} from "./MeshComponent";

export class RigidBodyComponent implements IComponent {
    public name: string = "RigidBody";
    public entity: Entity;
    public scene: Scene;

    // component properties
    public body!: B.PhysicsBody;
    public shape!: B.PhysicsShape;

    /**
     * @throws Error if entity does not have a MeshComponent
     */
    constructor(entity: Entity, scene: Scene, props:
        {
            shape: B.PhysicsShape,
            motionType?: B.PhysicsMotionType,
            massProps?: B.PhysicsMassProperties,
            activateCallbacks?: boolean
        })
    {
        this.entity = entity;
        this.scene = scene;

        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;

        this.body = this.createPhysicsBody(meshComponent.mesh, props.motionType, props.massProps);
        this.body.shape = props.shape;
    }

    public onStart(): void {}

    public onUpdate(): void {}

    public onDestroy(): void {
        this.body.dispose();
        this.shape.dispose();
    }

    /**
     * Creates a physics body
     * @param mesh
     * @param _motionType
     * @param massProps
     */
    public createPhysicsBody(mesh: B.Mesh, _motionType?: B.PhysicsMotionType, massProps?: B.PhysicsMassProperties): B.PhysicsBody {
        const motionType: B.PhysicsMotionType = _motionType ?? B.PhysicsMotionType.DYNAMIC;

        const body = new B.PhysicsBody(mesh, motionType, false, this.scene.scene);

        if (massProps) {
            body.setMassProperties(massProps);
        }

        return body;
    }
}