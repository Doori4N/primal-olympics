import * as B from "@babylonjs/core";
import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {PlayerBehaviour} from "./PlayerBehaviour";
import {GameScores} from "./GameScores";
import {NetworkHost} from "../../../network/NetworkHost";

export class TRexBeheviour implements IComponent {
    public name: string = "TRexBeheviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _velocityX: number = 0;
    private _accelerationX: number = .00014;
    private _isGameStarted: boolean = false;
    private _isGameFinished: boolean = false;
    private _networkAnimationComponent!: NetworkAnimationComponent;
    private _mesh!: B.Mesh;
    private _observer!: B.Observer<B.IBasePhysicsCollisionEvent>;

    // event listeners
    private _onPlaySoundEvent = this._onPlaySoundClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this._networkAnimationComponent = this.entity.getComponent("NetworkAnimation") as NetworkAnimationComponent;
        this._networkAnimationComponent.startAnimation("Idle", {loop: true});

        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = meshComponent.mesh;

        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.physicsPlugin!.onTriggerCollisionObservable;
            this._observer = observable.add(this._onTriggerCollision.bind(this));
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.addEventListener("playSound", this._onPlaySoundEvent);
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this._isGameStarted || this._isGameFinished) return;

        if (!this.scene.game.networkInstance.isHost) return;

        // HOST
        this._mesh.position.x += this._velocityX;
        this._velocityX += this._accelerationX;

        if (!this._networkAnimationComponent.isPlaying("Attack")) {
            this._networkAnimationComponent.startAnimation("Running", {loop: true});
        }
    }

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) this._observer.remove();
        // CLIENT
        else this.scene.game.networkInstance.removeEventListener("playSound", this._onPlaySoundEvent);
    }

    private _onGameStarted(): void {
        this._isGameStarted = true;
        this.scene.game.soundManager.playSound("trex-roar");
        setTimeout((): void => {
            this.scene.game.soundManager.playSound("trex-step", {sprite: "step"});
        }, 2000);
    }

    private _onGameFinished(): void {
        this._isGameFinished = true;
        this.scene.game.soundManager.stopSound("trex-step");
        this.scene.game.soundManager.playSound("trex-roar");
    }

    private _onTriggerCollision(event: B.IBasePhysicsCollisionEvent): void {
        if (event.type !== "TRIGGER_ENTERED") return;

        const collider: B.TransformNode = event.collider.transformNode;
        const collidedAgainst: B.TransformNode = event.collidedAgainst.transformNode;

        if (collider.metadata?.tag === "player" && collidedAgainst.metadata?.tag === "t-rex") {
            const playerEntity: Entity = this.scene.entityManager.getEntityById(collider.metadata.id);
            const playerMeshComponent = playerEntity.getComponent("Mesh") as MeshComponent;
            const playerMesh: B.Mesh = playerMeshComponent.mesh;

            const playerBehaviour = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
            if (playerBehaviour.hasFinished) return;

            playerBehaviour.hasFinished = true;

            // rotate t-rex towards player
            const rotationY: number = Math.atan2(playerMesh.position.z - this._mesh.position.z, -(playerMesh.position.x - this._mesh.position.x)) - Math.PI / 2;
            this._mesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, rotationY, 0);

            this._networkAnimationComponent.startAnimation("Attack");
            this.scene.game.soundManager.playSound("trex-bite");
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("playSound", "trex-bite");

            setTimeout((): void => {
                // kill player
                playerBehaviour.kill();

                // set player score
                const gameManagerEntity: Entity = this.scene.entityManager.getFirstEntityByTag("gameManager")!;
                const gameScores = gameManagerEntity.getComponent("GameScores") as GameScores;
                gameScores.setPlayerScore(playerBehaviour.playerData, true);
            }, 700);

            setTimeout((): void => {
                this._mesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, Math.PI / 2, 0);
            }, 1500);
        }
    }

    private _onPlaySoundClientRpc(sound: string): void {
        this.scene.game.soundManager.playSound(sound);
    }
}