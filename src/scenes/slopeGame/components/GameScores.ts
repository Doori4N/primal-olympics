import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {PlayerBehaviour} from "./PlayerBehaviour";
import {PlayerData} from "../../../network/types";
import {NetworkHost} from "../../../network/NetworkHost";
import * as GUI from "@babylonjs/gui";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";

export class GameScores implements IComponent {
    public name: string = "GameScores";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _triggerObserver!: B.Observer<B.IBasePhysicsCollisionEvent>;
    private _scores: {playerData: PlayerData, distance: number}[] = [];
    private _gui!: GUI.AdvancedDynamicTexture;

    // event listeners
    private _addPlayerScoreEvent = this._addPlayerScore.bind(this);
    private _updatePlayersEvent = this._updatePlayersClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.physicsPlugin!.onTriggerCollisionObservable;
            this._triggerObserver = observable.add(this._onTriggerCollision.bind(this));
            this.scene.eventManager.subscribe("onAddPlayerScore", this._addPlayerScore.bind(this));
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.addEventListener("onAddPlayerScore", this._addPlayerScoreEvent);
            this.scene.game.networkInstance.addEventListener("onUpdatePlayers", this._updatePlayersEvent);
        }

        this.scene.eventManager.subscribe("onMessageFinished", (): void => {
            setTimeout((): void => {
                this.scene.game.fadeIn((): void => {
                    this._displayEventScores();
                });
            }, 3000);
        });
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        this._gui.dispose();

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            this._triggerObserver.remove();
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.removeEventListener("onSetPlayerScore", this._addPlayerScoreEvent);
            this.scene.game.networkInstance.removeEventListener("onUpdatePlayers", this._updatePlayersEvent);
        }
    }

    private _displayEventScores(): void {
        this._scores.sort((a, b) => b.distance - a.distance);

        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene.babylonScene);
        this._displayPlayerScores();

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            this.setPlayerMedals();

            // updates medals for other clients
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onUpdatePlayers", {players: this.scene.game.networkInstance.players});
        }

        this.scene.game.soundManager.playSound("crowd-cheer", {fade: {from: 0, duration: 3000}});

        setTimeout((): void => {
            this.scene.game.fadeIn((): void => {
                this.scene.eventManager.notify("onDisplayLeaderboard");
                this.entity.removeComponent("GameScores");
            });
        }, 7500);
    }

    private _displayPlayerScores(): void {
        const camera = new B.FreeCamera("scoreCamera", new B.Vector3(0, -12, -55), this.scene.babylonScene);
        this.scene.babylonScene.switchActiveCamera(camera);

        const player: Entity[] = this.scene.entityManager.getEntitiesByTag("player");
        player.forEach((player: Entity): void => {
            const playerMeshComponent = player.getComponent("Mesh") as MeshComponent;
            const playerBehaviour = player.getComponent("PlayerBehaviour") as PlayerBehaviour;
            const playerAnimationComponent = player.getComponent("NetworkAnimation") as NetworkAnimationComponent;
            playerAnimationComponent.startAnimation("Idle", {loop: true});

            const position: number = this._scores.findIndex((score): boolean => score.playerData.id === playerBehaviour.playerId);
            playerMeshComponent.mesh.rotationQuaternion = new B.Quaternion(0, 1, 0, 0);
            playerMeshComponent.mesh.position = new B.Vector3(position * 2 - (this._scores.length / 2), -13, -45);

            playerBehaviour.showPlayerNameUI(22, 6, -180);

            // player score text
            const playerScoreText = new GUI.TextBlock();
            playerScoreText.text = this._getPlayerPositionText(position);
            playerScoreText.color = "#22ff22";
            playerScoreText.fontSize = 25;
            playerScoreText.outlineColor = "black";
            playerScoreText.outlineWidth = 6;
            this._gui.addControl(playerScoreText);
            playerScoreText.linkWithMesh(playerMeshComponent.mesh);
            playerScoreText.linkOffsetY = 140;

            const isWin: boolean = (position <= 3);
            playerBehaviour.playRandomReactionAnimation(isWin);
        });
    }

    private _onTriggerCollision(collisionEvent: B.IBasePhysicsCollisionEvent): void {
        if (collisionEvent.type !== B.PhysicsEventType.TRIGGER_ENTERED) return;

        const collidedAgainst: B.TransformNode = collisionEvent.collidedAgainst.transformNode;
        const collider: B.TransformNode = collisionEvent.collider.transformNode;

        // handle collision with finishline
        if (collidedAgainst.metadata?.tag === "finishLine" && collider.metadata?.tag === "player") {
            const playerEntity: Entity = this.scene.entityManager.getEntityById(collider.metadata.id);
            const playerBehaviour = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
            playerBehaviour.stopPlayer();
            this._addPlayerScore(playerBehaviour.playerData, 1000);
        }
    }

    private setPlayerMedals(): void {
        for (let i: number = 0; i < this._scores.length; i++) {
            switch (i) {
                case 0:
                    this._scores[i].playerData.goldMedals++;
                    break;
                case 1:
                    this._scores[i].playerData.silverMedals++;
                    break;
                case 2:
                    this._scores[i].playerData.bronzeMedals++;
                    break;
                default:
                    break;
            }
        }
    }

    private _addPlayerScore(playerData: PlayerData, distance: number): void {
        let isSplice: boolean = false;
        for (let i: number = 0; i < this._scores.length; i++) {
            if (this._scores[i].distance < distance) {
                this._scores.splice(i, 0, {playerData, distance});
                isSplice = true;
                break;
            }
        }
        if (!isSplice) this._scores.push({playerData, distance});

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onAddPlayerScore", playerData, distance);
        }

        // check if all players have finished
        if (this._scores.length === this.scene.game.networkInstance.players.length) {
            this.scene.eventManager.notify("onGameFinished");
        }
    }

    private _updatePlayersClientRpc(args: {players: PlayerData[]}): void {
        this.scene.game.networkInstance.players = args.players;
    }

    private _getPlayerPositionText(position: number): string {
        switch (position) {
            case 0:
                return "1st";
            case 1:
                return "2nd";
            case 2:
                return "3rd";
            default:
                return `${position + 1}th`;
        }
    }
}