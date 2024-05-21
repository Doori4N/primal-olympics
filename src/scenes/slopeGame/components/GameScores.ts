import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {NetworkHost} from "../../../network/NetworkHost";

export class GameScores implements IComponent {
    public name: string = "GameScores";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _triggerObserver!: B.Observer<B.IBasePhysicsCollisionEvent>;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.physicsPlugin!.onTriggerCollisionObservable;
            this._triggerObserver = observable.add(this._onTriggerCollision.bind(this));
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        if (this.scene.game.networkInstance.isHost) {
            this._triggerObserver.remove();
        }
    }

    private _onTriggerCollision(collisionEvent: B.IBasePhysicsCollisionEvent): void {
        if (collisionEvent.type !== B.PhysicsEventType.TRIGGER_ENTERED) return;

        const collidedAgainst: B.TransformNode = collisionEvent.collidedAgainst.transformNode;
        const collider: B.TransformNode = collisionEvent.collider.transformNode;
        const networkHost = this.scene.game.networkInstance as NetworkHost;

        // handle collision with finishline
        if (collidedAgainst.metadata.tag === "finishLine" && collider.metadata.tag === "player") {
            console.log("player finished the game!");
            const playerEntity: Entity = this.scene.entityManager.getEntityById(collider.metadata.id);
            this.scene.entityManager.removeEntity(playerEntity);
            networkHost.sendToAllClients("onDestroyPlayer", {entityId: playerEntity.id});
        }

         // ground collision
        if (collidedAgainst.metadata.tag === "log" && collider.metadata.tag === "slope") {
            console.log("buche dans tes morts a pas touche le sol ptn de t mort");
        }

        // handle collision with log or rock
        if (collidedAgainst.metadata.tag === "player" && (collider.metadata.tag === "log" || collider.metadata.tag === "rock")) {
            console.log("player hit an obstacle!");
            const playerEntity: Entity = this.scene.entityManager.getEntityById(collidedAgainst.metadata.id);
            this.scene.entityManager.removeEntity(playerEntity);
            networkHost.sendToAllClients("onDestroyPlayer", {entityId: playerEntity.id});

            // update player score
        } 


    }
}