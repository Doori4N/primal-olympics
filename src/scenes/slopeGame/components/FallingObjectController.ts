import { Entity } from "../../../core/Entity";
import { IComponent } from "../../../core/IComponent";
import { Scene } from "../../../core/Scene";
import * as B from '@babylonjs/core';
import { MeshComponent } from "../../../core/components/MeshComponent";
import { RigidBodyComponent } from "../../../core/components/RigidBodyComponent";
import {Utils} from "../../../utils/Utils";
import {NetworkTransformComponent} from "../../../network/components/NetworkTransformComponent";
import {NetworkHost} from "../../../network/NetworkHost";

enum FallingObjectType {
    ROCK,
    LOG
}

export class FallingObjectController implements IComponent {
    public name: string = "FallingObjectController";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _intervalId!: number;
    private _observer!: B.Observer<B.IBasePhysicsCollisionEvent>;

    // event listeners
    private _onCreateFallingObjectEvent = this._spawnFallingObjectClientRpc.bind(this);
    private _onDestroyFallingObjectEvent = this._destroyFallingObjectClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.physicsPlugin!.onTriggerCollisionObservable;
            this._observer = observable.add(this._onTriggerCollision.bind(this));

            this.scene.eventManager.subscribe("onGameStarted", this.startSpawning.bind(this));
            this.scene.eventManager.subscribe("onGameFinished", this._stopSpawning.bind(this));
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.addEventListener("onCreateFallingObject", this._onCreateFallingObjectEvent);
            this.scene.game.networkInstance.addEventListener("onDestroyFallingObject", this._onDestroyFallingObjectEvent);
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            this._observer.remove();
            this.scene.eventManager.unsubscribe("onGameStarted", this.startSpawning.bind(this));
            this.scene.eventManager.unsubscribe("onGameFinished", this._stopSpawning.bind(this));
        }
        else {
           this.scene.game.networkInstance.removeEventListener("onCreateFallingObject", this._onCreateFallingObjectEvent);
              this.scene.game.networkInstance.removeEventListener("onDestroyFallingObject", this._onDestroyFallingObjectEvent);
        }
    }

    private startSpawning(): void {
        this._intervalId = setInterval((): void => {
            const randomPosition: B.Vector3 = new B.Vector3(Utils.randomInt(-14, 13), 35, Utils.randomInt(40,50)); // 18
            const randomType: FallingObjectType = Utils.randomInt(0, 1);
            const fallingObjectEntity: Entity = this._spawnFallingObject(randomPosition, randomType);
            this.scene.entityManager.addEntity(fallingObjectEntity);

            // tells clients to spawn the falling object
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onCreateFallingObject", {
                position: {x: randomPosition.x, y: randomPosition.y, z: randomPosition.z},
                type: randomType,
                entityId: fallingObjectEntity.id
            });
        }, 600);
    }

    private _spawnFallingObject(position: B.Vector3, type: FallingObjectType): Entity {
        if (type === FallingObjectType.ROCK) {
            return this._createRock(position);
        }
        else {
            return this._createLog(position);
        }
    }

    private _createLog(position: B.Vector3): Entity {
        const logEntity: Entity = new Entity("fallingObject");
    
        const entries: B.InstantiatedEntries = this.scene.loadedAssets["log"].instantiateModelsToScene(
            (sourceName: string): string => sourceName + logEntity.id,
            false,
            { doNotInstantiate: true }
        );
        const logMesh: B.Mesh = entries.rootNodes[0] as B.Mesh;

        logMesh.scaling = new B.Vector3(0.3, 0.3, 0.3);
        logMesh.position = position;
        logMesh.metadata = { tag: logEntity.tag, id: logEntity.id };

        logMesh.rotate(B.Axis.Z, Math.random() * Math.PI * 2, B.Space.WORLD);
    
        logEntity.addComponent(new MeshComponent(logEntity, this.scene, { mesh: logMesh }));
        const logPhysicsShape = new B.PhysicsShapeCylinder(
            new B.Vector3(-2, 0, 0),
            new B.Vector3(2, 0, 0),
                .4,
            this.scene.babylonScene
        );
        logEntity.addComponent(new RigidBodyComponent(logEntity, this.scene, {
            physicsShape: logPhysicsShape,
            physicsProps: { mass: 1, restitution: 0.53 }
        }));
        logEntity.addComponent(new NetworkTransformComponent(logEntity, this.scene, { usePhysics: true}));
    
        return logEntity;
    }
    
    
    private _createRock(position: B.Vector3): Entity {
        const rockEntity: Entity = new Entity("fallingObject");
    
        const entries: B.InstantiatedEntries = this.scene.loadedAssets["rock"].instantiateModelsToScene(
            (sourceName: string): string => sourceName + rockEntity.id,
            false,
            { doNotInstantiate: true }
        );
        const rockMesh: B.Mesh = entries.rootNodes[0] as B.Mesh;
    
        
        rockMesh.scaling = new B.Vector3(0.7, 0.7, 0.7); 
        rockMesh.position = position;
        rockMesh.metadata = { tag: rockEntity.tag, id: rockEntity.id };
    
        rockMesh.rotate(B.Axis.Z, Math.random() * Math.PI * 2, B.Space.WORLD);
    
        rockEntity.addComponent(new MeshComponent(rockEntity, this.scene, { mesh: rockMesh }));
        const rockPhysicsShape = new B.PhysicsShapeSphere(new B.Vector3(0, 0, 0), 0.5, this.scene.babylonScene);
        rockEntity.addComponent(new RigidBodyComponent(rockEntity, this.scene, {
            physicsShape: rockPhysicsShape,
            physicsProps: { mass: 1, restitution: 0.58 }
        }));
        rockEntity.addComponent(new NetworkTransformComponent(rockEntity, this.scene, { usePhysics: true }));
    
        return rockEntity;
    }
    

    private _stopSpawning(): void {
        clearInterval(this._intervalId);

        // destroy all falling objects
        const fallingObjects: Entity[] = this.scene.entityManager.getEntitiesByTag("fallingObject");
        fallingObjects.forEach((fallingObject: Entity): void => {
            this.scene.entityManager.removeEntity(fallingObject);
        });
    }

    private _onTriggerCollision(collisionEvent: B.IBasePhysicsCollisionEvent): void {
        if (collisionEvent.type !== B.PhysicsEventType.TRIGGER_ENTERED) return

        const collidedAgainst: B.TransformNode = collisionEvent.collidedAgainst.transformNode;
        const collider: B.TransformNode = collisionEvent.collider.transformNode;

        if (collidedAgainst.metadata?.tag === "despawnZone" && collider.metadata?.tag === "fallingObject") {
            const fallingObjectEntity: Entity = this.scene.entityManager.getEntityById(collider.metadata?.id);
            this.scene.entityManager.removeEntity(fallingObjectEntity);
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onDestroyFallingObject", {entityId: fallingObjectEntity.id});
        }
    }

    private _spawnFallingObjectClientRpc(info: {position: {x: number, y: number, z: number}, type: FallingObjectType, entityId: string}): void {
        const fallingObjectEntity: Entity = this._spawnFallingObject(new B.Vector3(info.position.x, info.position.y, info.position.z), info.type);
        fallingObjectEntity.id = info.entityId;
        this.scene.entityManager.addEntity(fallingObjectEntity);
    }

    private _destroyFallingObjectClientRpc(info: {entityId: string}): void {
        const fallingObjectEntity: Entity = this.scene.entityManager.getEntityById(info.entityId);
        this.scene.entityManager.removeEntity(fallingObjectEntity);
    }
}