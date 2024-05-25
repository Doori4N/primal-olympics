import * as B from "@babylonjs/core";
import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {PlayerBehaviour} from "./PlayerBehaviour";
import {GameScores} from "./GameScores";

export class TRexBeheviour implements IComponent {
    public name: string = "TRexBeheviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _velocityX: number = .05;
    private _isGameStarted: boolean = false;
    private _isGameFinished: boolean = false;
    private _networkAnimationComponent!: NetworkAnimationComponent;
    private _mesh!: B.Mesh;
    private _observer!: B.Observer<B.IBasePhysicsCollisionEvent>;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this._networkAnimationComponent = this.entity.getComponent("NetworkAnimation") as NetworkAnimationComponent;
        this._networkAnimationComponent.startAnimation("Idle", {loop: true});

        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = meshComponent.mesh;

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.physicsPlugin!.onTriggerCollisionObservable;
            this._observer = observable.add(this._onTriggerCollision.bind(this));

            this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
            this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this._isGameStarted || this._isGameFinished) return;

        if (!this.scene.game.networkInstance.isHost) return;

        // HOST
        this._mesh.position.x += this._velocityX;

        if (!this._networkAnimationComponent.isPlaying("Attack")) {
            this._networkAnimationComponent.startAnimation("Running", {loop: true});
        }
    }

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) this._observer.remove();
    }

    private _onGameStarted(): void {
        this._isGameStarted = true;
    }

    private _onGameFinished(): void {
        this._isGameFinished = true;
    }

    private _onTriggerCollision(event: B.IBasePhysicsCollisionEvent): void {
        if (event.type !== "TRIGGER_ENTERED") return;

        const collider: B.TransformNode = event.collider.transformNode;
        const collidedAgainst: B.TransformNode = event.collidedAgainst.transformNode;

        if (collider.metadata?.tag === "player" && collidedAgainst.metadata?.tag === "t-rex") {
            this._networkAnimationComponent.startAnimation("Attack");

            setTimeout((): void => {
                // kill player
                const playerEntity: Entity = this.scene.entityManager.getEntityById(collider.metadata.id);
                const playerBehaviour = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
                if (playerBehaviour.hasFinished) return;
                playerBehaviour.kill();

                // set player score
                const gameManagerEntity: Entity = this.scene.entityManager.getFirstEntityByTag("gameManager")!;
                const gameScores = gameManagerEntity.getComponent("GameScores") as GameScores;
                gameScores.setPlayerScore(playerBehaviour.playerData);
            }, 700);
        }
    }
}