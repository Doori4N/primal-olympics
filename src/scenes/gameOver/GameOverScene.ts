import {Scene} from "../../core/Scene";
import * as B from '@babylonjs/core';
import {PlayerData} from "../../network/types";
import {Utils} from "../../utils/Utils";
import * as GUI from "@babylonjs/gui";

export class GameOverScene extends Scene {
    // component properties
    private _gui!: GUI.AdvancedDynamicTexture;
    private _timer: number = 30;
    private _leaderboardDiv!: HTMLDivElement;
    private _resultsDiv!: HTMLDivElement;
    private _playerPositions: B.Vector3[] = [
        new B.Vector3(0, 0.5, 0),
        new B.Vector3(-3, 0.3, 0),
        new B.Vector3(3, 0.2, 0),
        new B.Vector3(-6.3, 0.1, 4),
        new B.Vector3(6.3, 0.1, 4),
        new B.Vector3(-8.3, 0.1, 4),
        new B.Vector3(8.3, 0.1, 4),
        new B.Vector3(-10.3, 0.1, 4),
    ];

    constructor() {
        super("Final Leaderboard");
    }

    public async preload(): Promise<void> {
        this.game.engine.displayLoadingUI();

        // load assets
        this.loadedAssets["map"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/scenes/", "trackScene.glb", this.babylonScene);
        this.loadedAssets["caveman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "caveman.glb", this.babylonScene);
        this.loadedAssets["cavewoman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "cavewoman.glb", this.babylonScene);

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        this.mainCamera.rotation = new B.Vector3(Math.PI / 10, 0, 0);
        this.mainCamera.attachControl(this.game.canvas, true);
        this.mainCamera.position.y += 2;
        this.mainCamera.position.z -= 2;

        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.babylonScene);

        // skybox
        const skybox: B.Mesh = B.MeshBuilder.CreateBox("skyBox", {size:1000.0}, this.babylonScene);
        const skyboxMaterial = new B.StandardMaterial("skyBox", this.babylonScene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new B.CubeTexture("/img/skybox", this.babylonScene);
        skyboxMaterial.reflectionTexture.coordinatesMode = B.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new B.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new B.Color3(0, 0, 0);
        skybox.material = skyboxMaterial;

        // light
        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.babylonScene);
        light.intensity = 0.7;

        this._createPodium();
        this._createTrack();

        // sort players by score
        const sortedPlayers: PlayerData[] = this.game.networkInstance.players.slice();
        sortedPlayers.sort(this._compareMedals.bind(this));

        this._displayUI(sortedPlayers[0]);

        sortedPlayers.forEach((player: PlayerData, index: number): void => {
            this._createPlayer(player, index);
        });
        for (let i: number = 1; i < 8; i++) {
            this._createPlayer(sortedPlayers[0], i);
        }
    }

    public destroy(): void {
        this._gui.dispose();
        this.game.uiContainer.removeChild(this._leaderboardDiv);
        this.game.uiContainer.removeChild(this._resultsDiv);
        super.destroy();
    }

    private _createPlayer(playerData: PlayerData, index: number): void {
        let playerContainer: B.AssetContainer;
        if (playerData.skinOptions.modelIndex === 0) {
            playerContainer = this.loadedAssets["caveman"];
        }
        else {
            playerContainer = this.loadedAssets["cavewoman"];
        }

        const entries: B.InstantiatedEntries = playerContainer.instantiateModelsToScene((sourceName: string): string => sourceName + playerData.id, true, {doNotInstantiate: true});
        const player = entries.rootNodes[0] as B.Mesh;

        let animation: B.AnimationGroup;
        if (index < 3) {
            animation = entries.animationGroups.find((animationGroup: B.AnimationGroup): boolean => animationGroup.name === `Victory${playerData.id}`)!;
        }
        else {
            animation = entries.animationGroups.find((animationGroup: B.AnimationGroup): boolean => animationGroup.name === `Defeat${playerData.id}`)!;
        }
        animation.start(true)

        player.position = this._playerPositions[index];
        player.scaling.scaleInPlace(0.25);
        player.rotate(B.Axis.Y, Math.PI, B.Space.WORLD);

        // player skin colors
        Utils.applyColorsToMesh(player, playerData.skinOptions);

        // player score text
        const playerScoreText = new GUI.TextBlock();
        playerScoreText.text = this._getPlayerPositionText(index);
        playerScoreText.color = "#22ff22";
        playerScoreText.fontSize = 22;
        playerScoreText.outlineColor = "black";
        playerScoreText.outlineWidth = 5;
        this._gui.addControl(playerScoreText);
        playerScoreText.linkWithMesh(player);
        playerScoreText.linkOffsetY = 40;

        // player name text
        const playerNameText = new GUI.TextBlock();
        playerNameText.text = playerData.name;
        playerNameText.color = "#ff2222";
        playerNameText.fontSize = 19;
        playerNameText.outlineColor = "black";
        playerNameText.outlineWidth = 4;
        this._gui.addControl(playerNameText);
        playerNameText.linkWithMesh(player);
        playerNameText.linkOffsetY = -190;
    }

    private _createTrack(): void {
        const mapContainer: B.AssetContainer = this.loadedAssets["map"];
        mapContainer.addAllToScene();
        const mapMesh = mapContainer.meshes[0] as B.Mesh;
        mapMesh.scaling.scaleInPlace(0.2);
        mapMesh.rotate(B.Axis.Y, -Math.PI / 2, B.Space.WORLD);
        mapMesh.position = new B.Vector3(-30, 0, -4);
    }

    private _displayUI(winner: PlayerData): void {
        this._resultsDiv = document.createElement("div");
        this._resultsDiv.id = "final-results-div";
        this._resultsDiv.innerHTML = `
            <h1>${winner.name} wins the primal olympics!</h1>
        `;
        this.game.uiContainer.appendChild(this._resultsDiv);

        this._leaderboardDiv = document.createElement("div");
        this._leaderboardDiv.innerHTML = `
            <img src="img/primal-olympics-logo.png" class="bottom-right-logo">
            <div class="bottom-border"></div>
        `;
        this.game.uiContainer.appendChild(this._leaderboardDiv);

        const topBorderDiv: HTMLDivElement = document.createElement("div");
        topBorderDiv.className = "top-border";
        this._leaderboardDiv.appendChild(topBorderDiv);

        const title: HTMLParagraphElement = document.createElement("p");
        title.className = "top-title left-title";
        title.textContent = "Final Leaderboard";
        topBorderDiv.appendChild(title);

        // timer
        const timerText: HTMLParagraphElement = document.createElement("p");
        timerText.className = "top-title right-title";
        timerText.textContent = `${this._timer}`;
        topBorderDiv.appendChild(timerText);

        // countdown interval
        const interval: number = setInterval((): void => {
            this._timer--;
            if (this._timer < 0) {
                clearInterval(interval);
                this.game.fadeIn((): void => {
                    this.sceneManager.changeScene("menu");
                });
            }
            else {
                this._updateTimer();
            }
        }, 1000);
    }

    private _updateTimer(): void {
        const timerText = document.querySelector(".top-title.right-title") as HTMLParagraphElement;
        timerText.textContent = `${this._timer}`;
    }

    private _createPodium(): void {
        const podiumBaseWidth: number = 3;
        const podiumBaseDepth: number = 1;

        const stage1Height: number = 0.5;
        const stage2Height: number = 0.30;
        const stage3Height: number = 0.20;

        const stage1Position = new B.Vector3(0, stage1Height / 2, 0);
        const stage2Position = new B.Vector3(-podiumBaseWidth, stage2Height / 2, 0);
        const stage3Position = new B.Vector3(podiumBaseWidth, stage3Height / 2, 0);

        // stage 1
        const stage1: B.Mesh = B.MeshBuilder.CreateBox("stage1", {width: podiumBaseWidth, height: stage1Height, depth: podiumBaseDepth}, this.babylonScene);
        stage1.position = stage1Position;
        const goldMaterial = new B.StandardMaterial("stage1Mat", this.babylonScene);
        goldMaterial.diffuseColor = new B.Color3(1, 0.8, 0);
        stage1.material = goldMaterial;

        // stage 2
        const stage2: B.Mesh = B.MeshBuilder.CreateBox("stage2", {width: podiumBaseWidth, height: stage2Height, depth: podiumBaseDepth}, this.babylonScene);
        stage2.position = stage2Position;
        const silverMaterial = new B.StandardMaterial("stage2Mat", this.babylonScene);
        silverMaterial.diffuseColor = new B.Color3(0.75, 0.75, 0.75);
        stage2.material = silverMaterial;

        // stage 3
        const stage3 = B.MeshBuilder.CreateBox("stage3", {width: podiumBaseWidth, height: stage3Height, depth: podiumBaseDepth}, this.babylonScene);
        stage3.position = stage3Position;
        const bronzeMaterial = new B.StandardMaterial("stage3Mat", this.babylonScene);
        bronzeMaterial.diffuseColor = new B.Color3(0.8, 0.5, 0.2);
        stage3.material = bronzeMaterial;
    }

    private _compareMedals(a: PlayerData, b: PlayerData): number {
        return this._getScore(b) - this._getScore(a);
    }

    private _getScore(player: PlayerData): number {
        return player.goldMedals * 3 + player.silverMedals * 2 + player.bronzeMedals;
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