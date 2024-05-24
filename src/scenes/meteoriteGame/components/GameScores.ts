import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {PlayerBehaviour} from "./PlayerBehaviour";
import {GameTimer} from "../../../core/components/GameTimer";
import {PlayerData} from "../../../network/types";
import {NetworkInstance} from "../../../network/NetworkInstance";
import {NetworkHost} from "../../../network/NetworkHost";
import {MeshComponent} from "../../../core/components/MeshComponent";
import * as B from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";

export class GameScores implements IComponent {
    public name: string = "GameScores";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _scores: {playerData: PlayerData, score: number}[] = [];
    private _deadPlayers: number = 0;
    private _gameTimer!: GameTimer;
    private readonly _networkInstance: NetworkInstance;
    private _gui!: GUI.AdvancedDynamicTexture;

    // event listeners
    private _setPlayerScoreEvent = this._setPlayerScoreClientRpc.bind(this);
    private _updatePlayersEvent = this._updatePlayersClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
        this._networkInstance = this.scene.game.networkInstance;
    }

    public onStart(): void {
        if (!this._networkInstance.isHost) {
            this._networkInstance.addEventListener("onSetPlayerScore", this._setPlayerScoreEvent);
            this._networkInstance.addEventListener("onUpdatePlayers", this._updatePlayersEvent);
        }

        this.scene.eventManager.subscribe("onGameStarted", this._initScores.bind(this));
        this.scene.eventManager.subscribe("onMessageFinished", (): void => {
            setTimeout((): void => {
                this.scene.game.soundManager.stopSound("lava", {fade: {to: 0, duration: 4000}});
                this.scene.game.fadeIn((): void => {
                    this._displayEventScores();
                });
            }, 3000);
        });

        const gameController: Entity | null = this.scene.entityManager.getFirstEntityByTag("gameManager");
        if (!gameController) throw new Error("Game controller not found");
        this._gameTimer = gameController.getComponent("GameTimer") as GameTimer;
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        this._gui.dispose();

        // HOST
        if (!this._networkInstance.isHost) {
            this._networkInstance.removeEventListener("onSetPlayerScore", this._setPlayerScoreEvent);
            this._networkInstance.removeEventListener("onUpdatePlayers", this._updatePlayersEvent);
        }
    }

    private _initScores(): void {
        this._networkInstance.players.forEach((playerData: PlayerData): void => {
            this._scores.push({
                playerData: playerData,
                score: 0
            });
        });
    }

    public setPlayerScore(playerEntity: Entity): void {
        const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
        const playerData: PlayerData = this._networkInstance.players.find((playerData: PlayerData): boolean => playerData.id === playerBehaviourComponent.playerId)!;

        const playerScore = this._scores.find((score): boolean => score.playerData.id === playerData.id)!;
        playerScore.score = this._gameTimer.timer;

        const networkHost = this._networkInstance as NetworkHost;
        networkHost.sendToAllClients("onSetPlayerScore", {playerId: playerData.id, score: playerScore.score});

        this._deadPlayers++;
        this.checkGameOver();
    }

    private checkGameOver(): void {
        // check if all players are dead
        if (this._deadPlayers === this._scores.length) {
            this._gameTimer.stopTimer();
        }
    }

    private _displayEventScores(): void {
        this._scores.sort((a, b) => a.score - b.score);

        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene.babylonScene);
        this._displayPlayerScores();

        if (this._networkInstance.isHost) {
            this.setPlayerMedals();
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

            const position: number = this._scores.findIndex((score): boolean => score.playerData.id === playerBehaviour.playerId);
            playerMeshComponent.mesh.rotationQuaternion = new B.Quaternion(0, 1, 0, 0);
            playerMeshComponent.mesh.position = new B.Vector3(position * 2 - (this._scores.length / 2), 1, 0);

            playerBehaviour.showPlayerNameUI(22, 6, -180);

            // player score text
            const playerScoreText = new GUI.TextBlock();
            playerScoreText.text = `${120 - this._scores[position].score}s`;
            playerScoreText.color = "#22ff22";
            playerScoreText.fontSize = 25;
            playerScoreText.outlineColor = "black";
            playerScoreText.outlineWidth = 6;
            this._gui.addControl(playerScoreText);
            playerScoreText.linkWithMesh(playerMeshComponent.mesh);
            playerScoreText.linkOffsetY = 140;

            const isWin: boolean = !(position > 2 && this._scores[position].score !== 0);
            playerBehaviour.playRandomReactionAnimation(isWin);
        });
    }

    private setPlayerMedals(): void {
        let firstPlaces: number = 0;
        for (let i: number = 0; i < this._scores.length; i++) {
            // in case of a tie, all players get the same medal
            if (this._scores[i].score === 0 || i === 0) {
                this._scores[i].playerData.goldMedals++;
                firstPlaces++;
            }
            switch (i) {
                case firstPlaces:
                    this._scores[i].playerData.silverMedals++;
                    break;
                case firstPlaces + 1:
                    this._scores[i].playerData.bronzeMedals++;
                    break;
                default:
                    break;
            }
        }

        const networkHost = this._networkInstance as NetworkHost;
        networkHost.sendToAllClients("onUpdatePlayers", {players: this._networkInstance.players});
    }

    private _setPlayerScoreClientRpc(args: {playerId: string, score: number}): void {
        const playerScore = this._scores.find((score): boolean => score.playerData.id === args.playerId)!;
        playerScore.score = args.score;

        this._deadPlayers++;
        this.checkGameOver();
    }

    private _updatePlayersClientRpc(args: {players: PlayerData[]}): void {
        this._networkInstance.players = args.players;
    }
}