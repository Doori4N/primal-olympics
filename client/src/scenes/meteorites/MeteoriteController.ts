import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import * as B from '@babylonjs/core';
import {MeshComponent} from "../../components/MeshComponent";
import {RigidBodyComponent} from "../../components/RigidBodyComponent";
import {MeteoriteBehaviour} from "./MeteoriteBehaviour";

export class MeteoriteController implements IComponent {
    public name: string = "MeteoriteController";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private observer!: B.Observer<B.IBasePhysicsCollisionEvent>;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.game.physicsPlugin.onTriggerCollisionObservable;
        this.observer = observable.add(this.onTriggerCollision.bind(this));

        this.scene.eventManager.subscribe("onPresentationFinished", this.startSpawning.bind(this));
    }

    public onUpdate(): void {

    }

    public onDestroy(): void {
        this.observer.remove();
    }

    private startSpawning(): void {
        setInterval((): void => {
            const randomPosition: B.Vector3 = new B.Vector3(
                Math.random() * 15 - 7.5,
                50,
                Math.random() * 15 - 7.5
            );
            this.spawnMeteorite(randomPosition);
        }, 1000);
    }

    private spawnMeteorite(position: B.Vector3): void {
        const meteoriteEntity = new Entity("meteorite");
        const meteorite: B.Mesh = B.MeshBuilder.CreateSphere(`meteorite${meteoriteEntity.id}`, {diameter: 2}, this.scene.scene);
        meteorite.metadata = {tag: meteoriteEntity.tag, id: meteoriteEntity.id};
        meteorite.position = position;
        meteoriteEntity.addComponent(new MeshComponent(meteoriteEntity, this.scene, {mesh: meteorite}));
        meteoriteEntity.addComponent(new MeteoriteBehaviour(meteoriteEntity, this.scene));
        meteoriteEntity.addComponent(new RigidBodyComponent(meteoriteEntity, this.scene, {
            physicsShape: B.PhysicsShapeType.SPHERE,
            physicsProps: {
                mass: 1,
                friction: 0,
                restitution: 0
            },
            isTrigger: true
        }));
        this.scene.entityManager.addEntity(meteoriteEntity);
    }

    private onTriggerCollision(collisionEvent: B.IBasePhysicsCollisionEvent): void {
        if (collisionEvent.type === "TRIGGER_ENTERED") {
            // ground collision
            if (collisionEvent.collidedAgainst.transformNode.metadata?.tag === "ground") {
                const meteoriteEntity: Entity = this.scene.entityManager.getEntityById(collisionEvent.collider.transformNode.metadata?.id);
                this.scene.entityManager.destroyEntity(meteoriteEntity);
            }
            // player collision
            else if (collisionEvent.collider.transformNode.metadata?.tag === "player") {
                const playerEntity: Entity = this.scene.entityManager.getEntityById(collisionEvent.collider.transformNode.metadata?.id);
                this.scene.entityManager.destroyEntity(playerEntity);
            }
        }
    }
}