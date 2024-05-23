import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {GameMessages} from "../../../core/components/GameMessages";
import {NetworkHost} from "../../../network/NetworkHost";
import {NetworkAudioComponent} from "../../../network/components/NetworkAudioComponent";

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
    private _networkAudioComponent!: NetworkAudioComponent;

    // event listeners
    private _onGoalScoredEvent = this._onGoalScoredClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onPresentationFinished", this._onPresentationFinished.bind(this));

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.physicsPlugin!.onTriggerCollisionObservable;
            this._goalTriggerObserver = observable.add(this._onTriggerCollision.bind(this));

            this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
            this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.addEventListener("onGoalScored", this._onGoalScoredEvent);
        }

        this._networkAudioComponent = this.entity.getComponent("NetworkAudio") as NetworkAudioComponent;
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

        const collider: B.TransformNode = collisionEvent.collider.transformNode;
        const collidedAgainst: B.TransformNode = collisionEvent.collidedAgainst.transformNode;

        const networkHost = this.scene.game.networkInstance as NetworkHost;

        // check if the ball collided with a goal (left scores if the ball collided with the rightGoal)
        const isLeftScore: boolean = collidedAgainst?.metadata?.tag === "rightGoal";
        const isRightScore: boolean = collidedAgainst?.metadata?.tag === "leftGoal";

        if (collider?.metadata?.tag === "ball" && (isRightScore || isLeftScore)) {
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
            this.scene.eventManager.notify("onGoalScored");

            // audio
            this._networkAudioComponent.playSound("Crowd", {
                volume: 0.4,
                offset: 3.5,
                duration: 5.5,
                fade: {fadeVolume: 0, fadeOutDelay: 3, fadeOutDuration: 2}
            });
            this._networkAudioComponent.playSound("Whistle", {volume: 0.5, offset: 9, duration: 1});

            setTimeout((): void => {
                this._networkAudioComponent.playSound("Whistle", {volume: 0.5, offset: 9, duration: 1});
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
    }

    private _onGameStarted(): void {
        this._networkAudioComponent.playSound("Whistle", {volume: 0.5, offset: 9, duration: 1});
    }

    private _onGameFinished(): void {
        this._networkAudioComponent.playSound("Whistle", {volume: 0.5, offset: 3, duration: 1.5});
        this._networkAudioComponent.stopSound("CrowdAmbience");
    }

    private _onPresentationFinished(): void {
        this._scoreDiv = document.createElement("div");
        this._scoreDiv.id = "score-container";
        this.scene.game.uiContainer.appendChild(this._scoreDiv);

        this._scoreText = document.createElement("p");
        this._scoreText.id = "score-text";
        this._scoreText.innerHTML = "0 - 0";
        this._scoreDiv.appendChild(this._scoreText);

        if (this.scene.game.networkInstance.isHost) {
            this._networkAudioComponent.playSound("CrowdAmbience", {
                fade: {fadeVolume: 0.3, fadeOutDelay: 0, fadeOutDuration: 8}
            });
        }
    }
}