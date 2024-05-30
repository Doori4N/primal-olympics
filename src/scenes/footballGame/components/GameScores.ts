import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {PlayerData} from "../../../network/types";
import {NetworkInstance} from "../../../network/NetworkInstance";
import * as B from "@babylonjs/core";
import {GameController} from "./GameController";
import {PlayerBehaviour} from "./players/PlayerBehaviour";
import {MeshComponent} from "../../../core/components/MeshComponent";
import * as GUI from "@babylonjs/gui";

enum Result {
    WIN,
    DRAW,
    LOSE,
}

export class GameScores implements IComponent {
    public name: string = "GameScores";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private readonly _networkInstance: NetworkInstance;
    private _resultsDiv!: HTMLDivElement;
    private _leftPositionIndex: number = 1;
    private _rightPositionIndex: number = 1;
    private _gui!: GUI.AdvancedDynamicTexture;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
        this._networkInstance = this.scene.game.networkInstance;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene.babylonScene);
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        this.scene.game.uiContainer.removeChild(this._resultsDiv);
    }

    private _onGameFinished(): void {
        setTimeout((): void => {
            this.scene.game.fadeIn(this._setScoreScreen.bind(this));
        }, 3000);
    }

    private _setScoreScreen(): void {
        this.scene.entityManager.removeEntitiesByTag("aiPlayer");
        this.scene.entityManager.removeEntitiesByTag("ball");

        const camera = new B.FreeCamera("scoreCamera", new B.Vector3(0, 3, -10), this.scene.babylonScene);
        this.scene.babylonScene.switchActiveCamera(camera);

        const gameController = this.entity.getComponent("GameController") as GameController;
        const leftResult: Result = (gameController.score.left > gameController.score.right) ? Result.WIN : (gameController.score.left < gameController.score.right) ? Result.LOSE : Result.DRAW;

        this._displayResults(leftResult);
        this._setPlayerScores(leftResult);

        setTimeout((): void => {
            this.scene.game.fadeIn((): void => {
                this.scene.eventManager.notify("onDisplayLeaderboard");
                this.entity.removeComponent("GameScores");
                this.entity.removeComponent("GameController");
            });
        }, 10000);
    }

    private _setPlayerScores(leftResult: Result): void {
        const players: Entity[] = this.scene.entityManager.getEntitiesByTag("player");
        players.forEach((player: Entity): void => {
            const playerBehaviour = player.getComponent("PlayerBehaviour") as PlayerBehaviour;
            const playerMeshComponent = player.getComponent("Mesh") as MeshComponent;
            const playerData: PlayerData = this._networkInstance.players.find((p: PlayerData): boolean => p.id === playerBehaviour.playerId)!;
            playerMeshComponent.mesh.rotationQuaternion = new B.Quaternion(0, 1, 0, 0);

            playerBehaviour.hidePlayerNameUI();
            playerBehaviour.showPlayerNameUI(2.8 * this.scene.game.viewportHeight, 0.7 * this.scene.game.viewportHeight, -23 * this.scene.game.viewportHeight);

            // player score text
            const playerScoreText = new GUI.TextBlock();
            playerScoreText.text = (playerBehaviour.teamIndex === 0) ? (leftResult === Result.WIN ? "1st" : "2nd") : (leftResult === Result.LOSE ? "1st" : "2nd");
            playerScoreText.color = "#22ff22";
            playerScoreText.fontSize = 3 * this.scene.game.viewportHeight;
            playerScoreText.outlineColor = "black";
            playerScoreText.outlineWidth = 0.7 * this.scene.game.viewportHeight;
            this._gui.addControl(playerScoreText);
            playerScoreText.linkWithMesh(playerMeshComponent.mesh);
            playerScoreText.linkOffsetY = 18 * this.scene.game.viewportHeight;

            // play reaction animation
            if (this.scene.game.networkInstance.isHost) {
                playerBehaviour.playRandomReactionAnimation((playerBehaviour.teamIndex === 0) ? (leftResult === Result.WIN) : (leftResult === Result.LOSE));
            }

            // reset position and add medals
            if (playerBehaviour.teamIndex === 0) {
                playerMeshComponent.mesh.position = new B.Vector3(-this._leftPositionIndex, 1, 0);
                this._leftPositionIndex++;
                if (leftResult === Result.WIN) playerData.goldMedals++;
                else if (leftResult === Result.DRAW) playerData.silverMedals++;
                else playerData.bronzeMedals++;
            }
            else {
                playerMeshComponent.mesh.position = new B.Vector3(this._rightPositionIndex, 1, 0);
                this._rightPositionIndex++;
                if (leftResult === Result.LOSE) playerData.goldMedals++;
                else if (leftResult === Result.DRAW) playerData.silverMedals++;
                else playerData.bronzeMedals++;
            }
        });
    }

    private _displayResults(blueResult: Result): void {
        this._resultsDiv = document.createElement("div");
        this._resultsDiv.id = "results-div";
        this._resultsDiv.innerHTML = `
            <h1>${(blueResult === Result.WIN) ? "Blue wins!" : (blueResult === Result.LOSE) ? "Orange wins!" : "Draw!"}</h1>
        `;
        this.scene.game.uiContainer.appendChild(this._resultsDiv);
    }
}