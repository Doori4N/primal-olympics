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
    private _scoreText!: HTMLParagraphElement;
    private _gameMessagesComponent!: GameMessages;
    public score: {left: number, right: number} = {left: 0, right: 0};
    private _canScoreGoal: boolean = true;

    // event listeners
    private _onGoalScoredEvent = this._onGoalScoredClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onPresentationFinished", this._onPresentationFinished.bind(this));
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.physicsPlugin!.onTriggerCollisionObservable;
            this._goalTriggerObserver = observable.add(this._onTriggerCollision.bind(this));
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.addEventListener("onGoalScored", this._onGoalScoredEvent);
        }

        this._gameMessagesComponent = this.entity.getComponent("GameMessages") as GameMessages;
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) this._goalTriggerObserver.remove()
        // CLIENT
        else this.scene.game.networkInstance.removeEventListener("onGoalScored", this._onGoalScoredEvent);

        this.scene.game.uiContainer.removeChild(this._scoreDiv);
    }

    private _updateScoreUI(): void {
        this._scoreText.innerHTML = `${this.score.left} - ${this.score.right}`;
    }

    private _onTriggerCollision(collisionEvent: B.IBasePhysicsCollisionEvent): void {
        if (collisionEvent.type !== B.PhysicsEventType.TRIGGER_ENTERED) return;

        if (!this._canScoreGoal) return;

        const collider: B.TransformNode = collisionEvent.collider.transformNode;
        const collidedAgainst: B.TransformNode = collisionEvent.collidedAgainst.transformNode;

        const networkHost = this.scene.game.networkInstance as NetworkHost;

        // check if the ball collided with a goal (left scores if the ball collided with the rightGoal)
        const isLeftScore: boolean = collidedAgainst?.metadata?.tag === "rightGoal";
        const isRightScore: boolean = collidedAgainst?.metadata?.tag === "leftGoal";

        if (collider?.metadata?.tag === "ball" && (isRightScore || isLeftScore)) {
            this._canScoreGoal = false;

            let goalPosition: number = 1;
            if (isLeftScore) {
                networkHost.sendToAllClients("onGoalScored", true);
                this.score.left++;
            }
            else {
                networkHost.sendToAllClients("onGoalScored", false);
                goalPosition = -1;
                this.score.right++;
            }

            // particle system
            const particleSystem: B.IParticleSystem = B.ParticleHelper.CreateDefault(new B.Vector3(20 * goalPosition, .1, 0));
            particleSystem.start();
            setTimeout((): void => {
                particleSystem.stop();
            }, 1500);

            this._updateScoreUI();
            this._gameMessagesComponent.displayMessage("GOAL!", 1500);
            setTimeout((): void => {
                this._canScoreGoal = true;
            }, 3000);
            this.scene.eventManager.notify("onGoalScored");

            // audio
            this.scene.game.soundManager.playSound("crowd", {sprite: "reaction", fade: {from: 0, duration: 4}});
            this.scene.game.soundManager.playSound("whistle", {sprite: "simpleWhistle"});

            setTimeout((): void => {
                this.scene.game.soundManager.playSound("whistle", {sprite: "simpleWhistle"});
            }, 3500);
        }
    }

    private _onGoalScoredClientRpc(isLeftScore: boolean): void {
        // update score
        if (isLeftScore) this.score.left++;
        else this.score.right++;
        this._updateScoreUI();
        this._gameMessagesComponent.displayMessage("GOAL!", 1500);
        this.scene.eventManager.notify("onGoalScored");

        // audio
        this.scene.game.soundManager.playSound("crowd", {sprite: "reaction", fade: {from: 0, duration: 4}});
        this.scene.game.soundManager.playSound("whistle", {sprite: "simpleWhistle"});

        setTimeout((): void => {
            this.scene.game.soundManager.playSound("whistle", {sprite: "simpleWhistle"});
        }, 3500);
    }

    private _onGameStarted(): void {
        this.scene.game.soundManager.playSound("whistle", {sprite: "simpleWhistle"});
    }

    private _onGameFinished(): void {
        this.scene.game.soundManager.playSound("whistle", {sprite: "longWhistle"});
        this.scene.game.soundManager.stopSound("crowd-ambience", {fade: {to: 0, duration: 4000}});
    }

    private _onPresentationFinished(): void {
        this._scoreDiv = document.createElement("div");
        this._scoreDiv.id = "score-container";
        this.scene.game.uiContainer.appendChild(this._scoreDiv);

        this._scoreText = document.createElement("p");
        this._scoreText.id = "score-text";
        this._scoreText.innerHTML = "0 - 0";
        this._scoreDiv.appendChild(this._scoreText);

        this.scene.game.soundManager.playSound("crowd-ambience", {fade: {from: 0, duration: 8000}});
    }
}