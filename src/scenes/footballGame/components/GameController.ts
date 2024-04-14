import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {GameMessages} from "../../../core/components/GameMessages";
import {NetworkHost} from "../../../network/NetworkHost";

export class GameController implements IComponent {
    public name: string = "GameController";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _goalTriggerObserver!: B.Observer<B.IBasePhysicsCollisionEvent>;
    private _scoreDiv!: HTMLDivElement;
    private _uiContainer!: Element;
    private _gameMessagesComponent!: GameMessages;
    private _score: {left: number, right: number} = {left: 0, right: 0};

    // event listeners
    private _onGoalScoredEvent = this._onGoalScoredClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.game.physicsPlugin.onTriggerCollisionObservable;
            this._goalTriggerObserver = observable.add(this._onTriggerCollision.bind(this));
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.addEventListener("onGoalScored", this._onGoalScoredEvent);
        }

        this._gameMessagesComponent = this.entity.getComponent("GameMessages") as GameMessages;

        this._uiContainer = document.querySelector("#ui")!;
        this._scoreDiv = document.createElement("div");
        this._scoreDiv.id = "score";
        this._scoreDiv.innerHTML = "0 - 0";
        this._uiContainer.appendChild(this._scoreDiv);
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) this._goalTriggerObserver.remove()
        // CLIENT
        else this.scene.game.networkInstance.removeEventListener("onGoalScored", this._onGoalScoredEvent);

        this._scoreDiv.remove();
    }

    private _updateScoreUI(): void {
        this._scoreDiv.innerHTML = `${this._score.left} - ${this._score.right}`;
    }

    private _onTriggerCollision(collisionEvent: B.IBasePhysicsCollisionEvent): void {
        if (collisionEvent.type !== B.PhysicsEventType.TRIGGER_ENTERED) return;

        const collider: B.TransformNode = collisionEvent.collider.transformNode;
        const collidedAgainst: B.TransformNode = collisionEvent.collidedAgainst.transformNode;

        const networkHost = this.scene.game.networkInstance as NetworkHost;

        if (collider?.metadata?.tag === "ball" && (collidedAgainst?.metadata?.tag === "rightGoal")) {
            networkHost.sendToAllClients("onGoalScored", true);
            this._score.left++;
            this._updateScoreUI();
            this._displayGoalMessage(this.scene.eventManager.notify.bind(this.scene.eventManager, "onGoalScored"));
        }
        else if (collider?.metadata?.tag === "ball" && (collidedAgainst?.metadata?.tag === "leftGoal")) {
            networkHost.sendToAllClients("onGoalScored", false);
            this._score.right++;
            this._updateScoreUI();
            this._displayGoalMessage(this.scene.eventManager.notify.bind(this.scene.eventManager, "onGoalScored"));
        }
    }

    private _onGoalScoredClientRpc(isLeftGoal: boolean): void {
        // update score
        if (isLeftGoal) this._score.left++;
        else this._score.right++;
        this._updateScoreUI();

        this._displayGoalMessage();
    }

    private _displayGoalMessage(callback?: Function): void {
        this._gameMessagesComponent.displayMessage("GOAL!", 1500, callback);
    }
}