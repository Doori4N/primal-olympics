import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {PlayerData} from "../../../network/types";
import {NetworkInstance} from "../../../network/NetworkInstance";
import {NetworkHost} from "../../../network/NetworkHost";
import * as GUI from "@babylonjs/gui";
import * as B from "@babylonjs/core";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {PlayerBehaviour} from "./PlayerBehaviour";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";

export class GameScores implements IComponent {
    public name: string = "GameScores";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _scores: {playerData: PlayerData, position: number}[] = [];
    private _deadPlayerScores: PlayerData[] = [];
    private readonly _networkInstance: NetworkInstance;
    private _gui!: GUI.AdvancedDynamicTexture;

    // event listeners
    private _setPlayerScoreEvent = this.setPlayerScore.bind(this);
    private _updatePlayersEvent = this._updatePlayersClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
        this._networkInstance = this.scene.game.networkInstance;
    }

    public onStart(): void {
        // CLIENT
        if (!this._networkInstance.isHost) {
            this._networkInstance.addEventListener("onSetPlayerScore", this._setPlayerScoreEvent);
            this._networkInstance.addEventListener("onUpdatePlayers", this._updatePlayersEvent);
        }

        this.scene.eventManager.subscribe("onMessageFinished", (): void => {
            setTimeout((): void => {
                this.scene.game.fadeIn((): void => {
                    this.scene.entityManager.removeEntitiesByTag("t-rex");
                    this._displayEventScores();
                });
            }, 3000);
        });
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        this._gui.dispose();

        // CLIENT
        if (!this._networkInstance.isHost) {
            this._networkInstance.removeEventListener("onSetPlayerScore", this._setPlayerScoreEvent);
            this._networkInstance.removeEventListener("onUpdatePlayers", this._updatePlayersEvent);
        }
    }

    public setPlayerScore(playerData: PlayerData, isDead: boolean): void {
        // check if player already has a score
        if (this._scores.some((score): boolean => score.playerData.id === playerData.id)) return;

        if (isDead) {
            this._deadPlayerScores.push(playerData);
        }
        else {
            this._scores.push({
                playerData: playerData,
                position: this._scores.length + 1
            });
        }

        // HOST
        if (this._networkInstance.isHost) {
            const networkHost = this._networkInstance as NetworkHost;
            networkHost.sendToAllClients("onSetPlayerScore", playerData, isDead);
        }

        // check if all players have finished
        if ((this._scores.length + this._deadPlayerScores.length) === this._networkInstance.players.length) {
            // set positions
            this._deadPlayerScores.reverse();
            this._deadPlayerScores.forEach((playerData: PlayerData): void => {
                this._scores.push({
                    playerData: playerData,
                    position: this._scores.length + 1
                });
            });

            this.scene.eventManager.notify("onGameFinished");
        }
    }

    private _displayEventScores(): void {
        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene.babylonScene);
        this._displayPlayerScores();

        // HOST
        if (this._networkInstance.isHost) {
            this.setPlayerMedals();

            // updates medals for other clients
            const networkHost = this._networkInstance as NetworkHost;
            networkHost.sendToAllClients("onUpdatePlayers", {players: this._networkInstance.players});
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
        const camera = new B.FreeCamera("scoreCamera", new B.Vector3(0, 3, -10), this.scene.babylonScene);
        this.scene.babylonScene.switchActiveCamera(camera);

        const player: Entity[] = this.scene.entityManager.getEntitiesByTag("player");
        player.forEach((player: Entity): void => {
            const playerMeshComponent = player.getComponent("Mesh") as MeshComponent;
            const playerBehaviour = player.getComponent("PlayerBehaviour") as PlayerBehaviour;
            const playerAnimationComponent = player.getComponent("NetworkAnimation") as NetworkAnimationComponent;
            playerAnimationComponent.startAnimation("Idle", {loop: true});

            const position: number = this._scores.findIndex((score): boolean => score.playerData.id === playerBehaviour.playerId);
            playerMeshComponent.mesh.rotationQuaternion = new B.Quaternion(0, 1, 0, 0);
            playerMeshComponent.mesh.position = new B.Vector3(position * 2 - (this._scores.length / 2), 1, 0);

            playerBehaviour.showPlayerNameUI(2.8 * this.scene.game.viewportHeight, 0.7 * this.scene.game.viewportHeight, -23 * this.scene.game.viewportHeight);

            // player score text
            const playerScoreText = new GUI.TextBlock();
            playerScoreText.text = this._getPlayerPositionText(this._scores[position].position);
            playerScoreText.color = "#22ff22";
            playerScoreText.fontSize = 3 * this.scene.game.viewportHeight;
            playerScoreText.outlineColor = "black";
            playerScoreText.outlineWidth = 0.7 * this.scene.game.viewportHeight;
            this._gui.addControl(playerScoreText);
            playerScoreText.linkWithMesh(playerMeshComponent.mesh);
            playerScoreText.linkOffsetY = 18 * this.scene.game.viewportHeight;

            const isWin: boolean = (position <= 3);
            playerBehaviour.playRandomReactionAnimation(isWin);
        });
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

    private _updatePlayersClientRpc(args: {players: PlayerData[]}): void {
        this._networkInstance.players = args.players;
    }

    private _getPlayerPositionText(position: number): string {
        switch (position) {
            case 1:
                return "1st";
            case 2:
                return "2nd";
            case 3:
                return "3rd";
            default:
                return `${position}th`;
        }
    }
}