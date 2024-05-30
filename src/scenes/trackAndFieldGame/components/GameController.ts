import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {PlayerBehaviour} from "./PlayerBehaviour";
import {GameScores} from "./GameScores";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {NetworkHost} from "../../../network/NetworkHost";

export class GameController implements IComponent {
    public name: string = "GameController";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _infoDiv!: HTMLDivElement;
    private _positionDiv!: HTMLDivElement;
    private _speedDiv!: HTMLDivElement;
    private _observer!: B.Observer<B.IBasePhysicsCollisionEvent>;
    private _isGameStated: boolean = false;
    private _isGameFinished: boolean = false;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.physicsPlugin!.onTriggerCollisionObservable;
            this._observer = observable.add(this._onTriggerCollision.bind(this));
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.addEventListener("setPosition", this._setPosition.bind(this));
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this.scene.game.networkInstance.isHost || !this._isGameStated || this._isGameFinished) return;
        // HOST
        this._updatePlayersPosition();
    }

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            this._observer.remove();
        }
    }

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

        const speedContainer = document.createElement("div") as HTMLDivElement;
        speedContainer.id = "speed-container";
        this._infoDiv.appendChild(speedContainer);

        this._speedDiv = document.createElement("div") as HTMLDivElement;
        this._speedDiv.id = "speed-div";
        this._speedDiv.className = "low-speed";
        speedContainer.appendChild(this._speedDiv);
    }

    public setSpeed(speed: number): void {
        if (!this._speedDiv) return;

        if (speed < 20) this._speedDiv.className = "low-speed";
        else if (speed < 40) this._speedDiv.className = "medium-speed";
        else this._speedDiv.className = "high-speed";

        const newSpeed: number = Math.min(100, speed);
        const width: number = newSpeed * 14 / 100;
        this._speedDiv.style.width = `${width}vw`;
    }

    private _setPosition(position: number): void {
        if (!this._positionDiv) return;

        if (position === 1) this._positionDiv.innerHTML = `${position}st`;
        else if (position === 2) this._positionDiv.innerHTML = `${position}nd`;
        else if (position === 3) this._positionDiv.innerHTML = `${position}rd`;
        else this._positionDiv.innerHTML = `${position}th`;
    }

    private _onTriggerCollision(event: B.IBasePhysicsCollisionEvent): void {
        if (event.type !== "TRIGGER_ENTERED") return;

        const collider: B.TransformNode = event.collider.transformNode;
        const collidedAgainst: B.TransformNode = event.collidedAgainst.transformNode;

        if (collider.metadata?.tag === "player" && collidedAgainst.metadata?.tag === "finishLine") {
            const playerEntity: Entity = this.scene.entityManager.getEntityById(collider.metadata.id);
            const playerBehaviour = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
            if (playerBehaviour.hasFinished) return;
            playerBehaviour.stopPlayer();

            // set player score
            const gameScores = this.entity.getComponent("GameScores") as GameScores;
            gameScores.setPlayerScore(playerBehaviour.playerData, false);
        }
    }
}