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
import {Utils} from "../../../utils/Utils";
import {NetworkTransformComponent} from "../../../network/components/NetworkTransformComponent";

export class MeteoriteController implements IComponent {
    public name: string = "MeteoriteController";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _observer!: B.Observer<B.IBasePhysicsCollisionEvent>;
    private _isGameStarted: boolean = false;
    private _isGameFinished: boolean = false;
    private _timeToWait: number = 0;
    private _shadowMaterial!: B.StandardMaterial;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this._shadowMaterial = new B.StandardMaterial("shadowMat", this.scene.babylonScene);
        this._shadowMaterial.diffuseColor = new B.Color3(0, 0, 0);
        this._shadowMaterial.alpha = 0.5;
        this._shadowMaterial.zOffset = -1;

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.physicsPlugin!.onTriggerCollisionObservable;
            this._observer = observable.add(this._onTriggerCollision.bind(this));

            this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
            this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.addEventListener("onCreateMeteorite", this._spawnMeteoriteClientRpc.bind(this));
            this.scene.game.networkInstance.addEventListener("onDestroyMeteorite", this._destroyMeteoriteClientRpc.bind(this));
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this._isGameStarted || this._isGameFinished || !this.scene.game.networkInstance.isHost) return;

        // HOST
        if (this._timeToWait > 0) {
            this._timeToWait -= this.scene.game.engine.getDeltaTime();
        }
        else {
            const halfMapSize: number = 9;
            const randomNumber: number = Utils.randomInt(1, 3);
            for (let i: number = 0; i < randomNumber; i++) {
                const randomPosition: B.Vector3 = new B.Vector3(Utils.randomInt(-halfMapSize, halfMapSize), 20, Utils.randomInt(-halfMapSize, halfMapSize));
                const meteoriteEntity: Entity = this._spawnMeteorite(randomPosition);
                this.scene.entityManager.addEntity(meteoriteEntity);

                const networkHost = this.scene.game.networkInstance as NetworkHost;
                const position = {x: randomPosition.x, y: randomPosition.y, z: randomPosition.z};
                networkHost.sendToAllClients("onCreateMeteorite", {position: position, entityId: meteoriteEntity.id});
            }

            const randomTime: number = Utils.randomInt(1, 6);
            this._timeToWait = randomTime * 100;
        }
    }

    public onDestroy(): void {
        this._observer.remove();
    }

    private _onGameStarted(): void {
        this._isGameStarted = true;
    }

    private _onGameFinished(): void {
        this._isGameFinished = true;

        // destroy all meteorites
        const meteorites: Entity[] = this.scene.entityManager.getEntitiesByTag("meteorite");
        meteorites.forEach((meteorite: Entity): void => {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onDestroyMeteorite", {entityId: meteorite.id});
            this.scene.entityManager.removeEntity(meteorite);
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

        meteorite.scaling = new B.Vector3(0.5, 0.3, 0.5);
        meteorite.metadata = {tag: meteoriteEntity.tag, id: meteoriteEntity.id};
        meteorite.position = position;
        meteorite.rotationQuaternion = B.Quaternion.FromEulerAngles(Utils.randomFloat(0, Math.PI * 2), 0, Utils.randomFloat(0, Math.PI * 2));

        meteoriteEntity.addComponent(new MeshComponent(meteoriteEntity, this.scene, {mesh: meteorite}));
        meteoriteEntity.addComponent(new NetworkTransformComponent(meteoriteEntity, this.scene, {useInterpolation: true}));
        meteoriteEntity.addComponent(new MeteoriteBehaviour(meteoriteEntity, this.scene, {shadowMaterial: this._shadowMaterial}));

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const rigidBodyComponent = new RigidBodyComponent(meteoriteEntity, this.scene, {
                physicsShape: B.PhysicsShapeType.SPHERE,
                physicsProps: {mass: 1},
                isTrigger: true
            });
            meteoriteEntity.addComponent(rigidBodyComponent);
            rigidBodyComponent.setBodyPreStep(false);
        }

        return meteoriteEntity;
    }

    private _onTriggerCollision(collisionEvent: B.IBasePhysicsCollisionEvent): void {
        if (collisionEvent.type === "TRIGGER_ENTERED") {
            // ground collision
            if (collisionEvent.collidedAgainst.transformNode.metadata?.tag === "ground" &&
                collisionEvent.collider.transformNode.metadata?.tag === "meteorite"
            ) {
                const meteoriteEntity: Entity = this.scene.entityManager.getEntityById(collisionEvent.collider.transformNode.metadata?.id);
                const networkHost = this.scene.game.networkInstance as NetworkHost;
                networkHost.sendToAllClients("onDestroyMeteorite", {entityId: meteoriteEntity.id});
                this.scene.entityManager.removeEntity(meteoriteEntity);
            }
            // player collision
            else if (collisionEvent.collider.transformNode.metadata?.tag === "player" &&
                collisionEvent.collidedAgainst.transformNode.metadata?.tag === "meteorite"
            ) {
                // kill player
                const playerEntity: Entity = this.scene.entityManager.getEntityById(collisionEvent.collider.transformNode.metadata?.id);
                const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
                playerBehaviourComponent.kill();

                // update player score
                const gameController: Entity | null = this.scene.entityManager.getFirstEntityByTag("gameManager");
                if (!gameController) throw new Error("Game controller not found");
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
        this.scene.entityManager.removeEntity(meteoriteEntity);
    }
}