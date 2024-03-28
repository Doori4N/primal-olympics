import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from '@babylonjs/core';
import {MeshComponent} from "../../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {MeteoriteBehaviour} from "./MeteoriteBehaviour";
import {PlayerBehaviour} from "./PlayerBehaviour";
import {GameScores} from "./GameScores";
import {NetworkHost} from "../../../network/NetworkHost";
import {NetworkMeshComponent} from "../../../network/components/NetworkMeshComponent";

export class MeteoriteController implements IComponent {
    public name: string = "MeteoriteController";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _observer!: B.Observer<B.IBasePhysicsCollisionEvent>;
    private _intervalId!: number;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.game.physicsPlugin.onTriggerCollisionObservable;
            this._observer = observable.add(this._onTriggerCollision.bind(this));

            this.scene.eventManager.subscribe("onGameStarted", this.startSpawning.bind(this));
            this.scene.eventManager.subscribe("onGameFinished", this.stopSpawning.bind(this));
        }
        else {
            this.scene.game.networkInstance.addEventListener("onCreateMeteorite", this._spawnMeteoriteClientRpc.bind(this));
            this.scene.game.networkInstance.addEventListener("onDestroyMeteorite", this._destroyMeteoriteClientRpc.bind(this));
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        this._observer.remove();
    }

    private startSpawning(): void {
        this._intervalId = setInterval((): void => {
            const randomPosition: B.Vector3 = new B.Vector3(
                Math.random() * 15 - 7.5,
                50,
                Math.random() * 15 - 7.5
            );
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            const meteoriteEntity: Entity = this._spawnMeteorite(randomPosition);
            const position = {x: randomPosition.x, y: randomPosition.y, z: randomPosition.z};
            networkHost.sendToAllClients("onCreateMeteorite", {position: position, entityId: meteoriteEntity.id});
            this.scene.entityManager.addEntity(meteoriteEntity);
        }, 500);
    }

    private stopSpawning(): void {
        clearInterval(this._intervalId);

        // destroy all meteorites
        const meteorites: Entity[] = this.scene.entityManager.getEntitiesWithTag("meteorite");
        meteorites.forEach((meteorite: Entity): void => {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onDestroyMeteorite", {entityId: meteorite.id});
            this.scene.entityManager.destroyEntity(meteorite);
        });
    }

    private _spawnMeteorite(position: B.Vector3, entityId?: string): Entity {
        const meteoriteEntity = new Entity("meteorite", entityId);
        const entries: B.InstantiatedEntries = this.scene.loadedAssets["meteorite"].instantiateModelsToScene(
            (sourceName: string): string => sourceName + meteoriteEntity.id,
            false,
            {doNotInstantiate: true}
        );
        const meteorite: B.Mesh = entries.rootNodes[0] as B.Mesh;

        meteorite.scaling = new B.Vector3(0.5, 0.5, 0.5);
        meteorite.metadata = {tag: meteoriteEntity.tag, id: meteoriteEntity.id};
        meteorite.position = position;

        meteoriteEntity.addComponent(new MeshComponent(meteoriteEntity, this.scene, {mesh: meteorite}));
        meteoriteEntity.addComponent(new NetworkMeshComponent(meteoriteEntity, this.scene, {mesh: meteorite}));
        meteoriteEntity.addComponent(new MeteoriteBehaviour(meteoriteEntity, this.scene));
        if (this.scene.game.networkInstance.isHost) {
            meteoriteEntity.addComponent(new RigidBodyComponent(meteoriteEntity, this.scene, {
                physicsShape: B.PhysicsShapeType.SPHERE,
                physicsProps: {
                    mass: 1
                },
                isTrigger: true
            }));
        }

        return meteoriteEntity;
    }

    private _onTriggerCollision(collisionEvent: B.IBasePhysicsCollisionEvent): void {
        if (collisionEvent.type === "TRIGGER_ENTERED") {
            // ground collision
            if (collisionEvent.collidedAgainst.transformNode.metadata?.tag === "ground") {
                const meteoriteEntity: Entity = this.scene.entityManager.getEntityById(collisionEvent.collider.transformNode.metadata?.id);
                const networkHost = this.scene.game.networkInstance as NetworkHost;
                networkHost.sendToAllClients("onDestroyMeteorite", {entityId: meteoriteEntity.id});
                this.scene.entityManager.destroyEntity(meteoriteEntity);
            }
            // player collision
            else if (collisionEvent.collider.transformNode.metadata?.tag === "player") {
                // kill player
                const playerEntity: Entity = this.scene.entityManager.getEntityById(collisionEvent.collider.transformNode.metadata?.id);
                const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
                playerBehaviourComponent.kill();

                // update player score
                const gameController: Entity = this.scene.entityManager.getFirstEntityWithTag("gameController");
                const gameScoresComponent = gameController.getComponent("GameScores") as GameScores;
                gameScoresComponent.setPlayerScore(playerEntity);
            }
        }
    }

    private _spawnMeteoriteClientRpc(args: {position: {x: number, y: number, z: number}, entityId: string}): void {
        const position: B.Vector3 = new B.Vector3(args.position.x, args.position.y, args.position.z);
        const meteoriteEntity: Entity = this._spawnMeteorite(position, args.entityId);
        this.scene.entityManager.addEntity(meteoriteEntity);
    }

    private _destroyMeteoriteClientRpc(args: {entityId: string}): void {
        const meteoriteEntity: Entity = this.scene.entityManager.getEntityById(args.entityId);
        this.scene.entityManager.destroyEntity(meteoriteEntity);
    }
}