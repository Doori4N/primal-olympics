import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {PlayerBehaviour} from "../../trackAndFieldGame/components/PlayerBehaviour";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {NetworkHost} from "../../../network/NetworkHost";
import * as B from '@babylonjs/core';
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";

const enum LogType {
    SMALL,
    MEDIUM,
    LARGE
}

export class GameController implements IComponent {
    public name: string = "GameController";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _infoDiv!: HTMLDivElement;
    private _positionDiv!: HTMLDivElement;
    private _isGameStated: boolean = false;
    private _isGameFinished: boolean = false;
    private _observer!: B.Observer<B.IBasePhysicsCollisionEvent>;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));

        // CLIENT
        if (!this.scene.game.networkInstance.isHost) {
            this.scene.game.networkInstance.addEventListener("setPosition", this._setPosition.bind(this));
        }
        // HOST
        else {
            this._createObstacles();
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.physicsPlugin!.onTriggerCollisionObservable;
            this._observer = observable.add(this._onTriggerCollision.bind(this));
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this.scene.game.networkInstance.isHost || !this._isGameStated || this._isGameFinished) return;
        // HOST
        this._updatePlayersPosition();
    }

    public onDestroy(): void {}

    private _updatePlayersPosition(): void {
        const players: Entity[] = this.scene.entityManager.getEntitiesByTag("player");

        const playersPosition: {playerId: string, distance: number}[] = players.map((player: Entity) => {
            const playerBehaviour = player.getComponent("PlayerBehaviour") as PlayerBehaviour;
            const playerMeshComponent = player.getComponent("Mesh") as MeshComponent;
            return {playerId: playerBehaviour.playerData.id, distance: playerMeshComponent.mesh.position.x};
        });

        playersPosition.sort((a, b) => a.distance - b.distance).reverse();

        playersPosition.forEach((playerPosition, index: number): void => {
            // if the host is this player set the position locally
            if (playerPosition.playerId === this.scene.game.networkInstance.playerId) {
                this._setPosition(index + 1);
            }
            // tell the client the position of the player
            else {
                const networkHost = this.scene.game.networkInstance as NetworkHost;
                const clientId: string = networkHost.getPeerId(playerPosition.playerId);
                networkHost.sendToClient("setPosition", clientId, index + 1);
            }
        });
    }

    private _onGameFinished(): void {
        this._isGameFinished = true;
        this.scene.game.uiContainer.removeChild(this._infoDiv);
        this.scene.game.soundManager.stopSound("fast-drum", {fade: {to: 0, duration: 5000}});
    }

    private _onGameStarted(): void {
        this.scene.game.soundManager.playSound("fast-drum");
        this._isGameStated = true;

        this._infoDiv = document.createElement("div") as HTMLDivElement;
        this.scene.game.uiContainer.appendChild(this._infoDiv);

        this._positionDiv = document.createElement("div") as HTMLDivElement;
        this._positionDiv.id = "position-div";
        this._positionDiv.innerHTML = "1st";
        this._infoDiv.appendChild(this._positionDiv);
    }

    private _setPosition(position: number): void {
        if (!this._positionDiv) return;

        if (position === 1) this._positionDiv.innerHTML = `${position}st`;
        else if (position === 2) this._positionDiv.innerHTML = `${position}nd`;
        else if (position === 3) this._positionDiv.innerHTML = `${position}rd`;
        else this._positionDiv.innerHTML = `${position}th`;
    }

    private _createObstacles(): void {
        this._createLog(new B.Vector3(10, 0.5, 7), LogType.SMALL);
    }

    private _createLog(position: B.Vector3, type: LogType): Entity {
        const logEntity = new Entity("log");

        const logContainer: B.AssetContainer = this.scene.loadedAssets["log"];
        const entries: B.InstantiatedEntries = logContainer.instantiateModelsToScene(
            (sourceName: string): string => sourceName + logEntity.id,
            false,
            {doNotInstantiate: true}
        );
        const log: B.Mesh = entries.rootNodes[0] as B.Mesh;

        log.scaling = new B.Vector3(1.2, 0.5, 0.5);
        log.metadata = {tag: logEntity.tag, id: logEntity.id};
        log.position = position;
        log.rotate(B.Axis.Y, Math.PI / 2, B.Space.WORLD);

        logEntity.addComponent(new MeshComponent(logEntity, this.scene, {mesh: log}));
        const logPhysicsShape = new B.PhysicsShapeCylinder(
            new B.Vector3(-8, 0, 0),
            new B.Vector3(8, 0, 0),
            .5,
            this.scene.babylonScene
        );
        logEntity.addComponent(new RigidBodyComponent(logEntity, this.scene, {
            physicsShape: logPhysicsShape,
            physicsProps: {mass: 0},
            isTrigger: true
        }));

        return logEntity;
    }

    private _onTriggerCollision(collisionEvent: B.IBasePhysicsCollisionEvent): void {
        if (collisionEvent.type !== B.PhysicsEventType.TRIGGER_ENTERED) return;

        const collidedAgainst: B.TransformNode = collisionEvent.collidedAgainst.transformNode;
        const collider: B.TransformNode = collisionEvent.collider.transformNode;

        if (collidedAgainst.metadata?.tag === "log" && collider.metadata?.tag === "player") {
            console.log("player hit log");
        }
    }
}
