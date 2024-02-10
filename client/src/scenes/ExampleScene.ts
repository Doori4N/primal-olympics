import {Scene} from "../core/Scene";
import * as B from '@babylonjs/core';
import {Entity} from "../core/Entity";
import {MeshComponent} from "../components/MeshComponent";
import {RigidBodyComponent} from "../components/RigidBodyComponent";
import {ExampleComponent} from "../components/ExampleComponent";

export class ExampleScene extends Scene {
    constructor() {
        super("Example");
    }

    public start(): void {
        super.start();

        // Enable physics engine
        const gravityVector = new B.Vector3(0, -9.81, 0);
        this.scene.enablePhysics(gravityVector, this.game.physicsPlugin);

        this.mainCamera.setTarget(B.Vector3.Zero());
        this.mainCamera.attachControl(this.game.canvas, true);

        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;

        // sphere entity
        const sphere: B.Mesh = B.MeshBuilder.CreateSphere("sphere", {diameter: 2}, this.scene);
        sphere.position.y = 4;
        const sphereEntity = new Entity();
        sphereEntity.addComponent(new MeshComponent(sphereEntity, this, {mesh: sphere}));
        sphereEntity.addComponent(new RigidBodyComponent(sphereEntity, this, {
            shape: new B.PhysicsShapeSphere(B.Vector3.Zero(), 1, this.scene),
            massProps: {
                mass: 1
            }
        }));
        sphereEntity.addComponent(new ExampleComponent(sphereEntity, this));
        this.entityManager.addEntity(sphereEntity);

        // ground entity
        const ground: B.GroundMesh = B.MeshBuilder.CreateGround("ground", {width: 6, height: 6}, this.scene);
        ground.position.y = 0;
        const groundEntity = new Entity();
        groundEntity.addComponent(new MeshComponent(groundEntity, this, {mesh: ground}));
        groundEntity.addComponent(new RigidBodyComponent(groundEntity, this, {
            shape: new B.PhysicsShapeConvexHull(ground, this.scene),
            motionType: B.PhysicsMotionType.STATIC,
            massProps: {
                mass: 0
            }
        }));
        this.entityManager.addEntity(groundEntity);
    }
}