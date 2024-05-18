import * as B from '@babylonjs/core';
import * as GUI from "@babylonjs/gui";
import {Scene} from "../../core/Scene";
import {Entity} from "../../core/Entity";
import {MeshComponent} from "../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../core/components/RigidBodyComponent";
import {NetworkHost} from "../../network/NetworkHost";
import {NetworkAnimationComponent} from "../../network/components/NetworkAnimationComponent";
import {NetworkPredictionComponent} from "../../network/components/NetworkPredictionComponent";
import {Commands, InputStates} from "../../core/types";
import {PlayerBehaviour} from "./components/PlayerBehaviour";
import {GamePresentation} from "../../core/components/GamePresentation";
import {GameMessages} from "../../core/components/GameMessages";
import {GameTimer} from "../../core/components/GameTimer";
import {CameraComponent} from "../../core/components/CameraComponent";
import {CameraAnimation} from "./components/CameraAnimation";
import {FallingObjectController} from "./components/FallingObjectController";
import {GameScores} from "./components/GameScores";

export class SlopeScene extends Scene {
    private _gui!: GUI.AdvancedDynamicTexture;

    constructor() {
        super("Downhill Madness");
    }

    public async preload(): Promise<void> {
        this.game.engine.displayLoadingUI();

        // load assets
        this.loadedAssets["player"] = await B.SceneLoader.LoadAssetContainerAsync(
            "meshes/models/",
            "caveman.glb",
            this.babylonScene
        );

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        this.enablePhysics(new B.Vector3(0, -9.81, 0));

        // camera
        this.mainCamera.position = new B.Vector3(0, -15, -60);
        this.mainCamera.setTarget(B.Vector3.Zero());
        this.mainCamera.attachControl(this.game.canvas, true);
        this.mainCamera.speed = 0.3;

        // start animation
        const cameraEntity = new Entity();
        const camera = new B.FreeCamera("camera", new B.Vector3(-10, 20, -20), this.babylonScene);
        camera.rotation.x = Math.PI / 4;
        cameraEntity.addComponent(new CameraComponent(cameraEntity, this, {camera: camera}));
        cameraEntity.addComponent(new CameraAnimation(cameraEntity, this));
        this.entityManager.addEntity(cameraEntity);

        // light
        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.babylonScene);
        light.intensity = 0.7;

        this._createSlope();

        // players
        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.babylonScene);
        this._initPlayers();

        this._createGameManager();

        // falling objects
        const fallingObjectController = new Entity();
        fallingObjectController.addComponent(new FallingObjectController(fallingObjectController, this));
        this.entityManager.addEntity(fallingObjectController);

        // finish line
        this._createFinishLine();
    }

    private _createSlope(): void {
        const slopeEntity = new Entity("slope");
        const slopeMesh: B.Mesh = B.MeshBuilder.CreateGround("ground", {width: 20, height: 100}, this.babylonScene);
    
        // Incliner le sol pour créer une pente
        slopeMesh.rotation = new B.Vector3(-Math.PI / 10, 0, 0); // -Math.PI / 14 ou -Math.PI / 12 voir les potos 
    
        slopeMesh.metadata = {tag: slopeEntity.tag};
        slopeEntity.addComponent(new MeshComponent(slopeEntity, this, {mesh: slopeMesh}));
        slopeEntity.addComponent(new RigidBodyComponent(slopeEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(slopeEntity);
    }
    

    private _createFinishLine(): void {
        const finishLine = new Entity("finishLine");
        const finishLineMesh: B.Mesh = B.MeshBuilder.CreateBox("finishLine", {width: 20, height: 10, depth: 1}, this.babylonScene);
        finishLineMesh.position = new B.Vector3(0, 5, 20);
        finishLineMesh.metadata = {tag: finishLine.tag};
        finishLine.addComponent(new MeshComponent(finishLine, this, {mesh: finishLineMesh}));
        finishLine.addComponent(new RigidBodyComponent(finishLine, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0},
            isTrigger: true
        }));
        this.entityManager.addEntity(finishLine);
    }

    private _initPlayers(): void {
        // HOST
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;

            for (let i: number = 0; i < networkHost.players.length; i++) {
                const playerId: string = networkHost.players[i].id;

                const playerEntity: Entity = this._createPlayer(playerId, i);
                this.entityManager.addEntity(playerEntity);

                networkHost.sendToAllClients("onCreatePlayer", {
                    playerId: playerId,
                    id: playerEntity.id,
                    index: i
                });
            }
        }
        // CLIENT
        else {
            this.game.networkInstance.addEventListener("onCreatePlayer", (args: {playerId: string, id: string, index: number}): void => {
                const playerEntity: Entity = this._createPlayer(args.playerId, args.index, args.id);
                this.entityManager.addEntity(playerEntity);
            });
            this.game.networkInstance.addEventListener("onDestroyPlayer", this._destroyPlayerClientRpc.bind(this));
        }
    }

    private _createPlayer(playerId: string, index: number, entityId?: string): Entity {
        const playerContainer: B.AssetContainer = this.loadedAssets["player"];
        const playerEntity = new Entity("player", entityId);

        const entries: B.InstantiatedEntries = playerContainer.instantiateModelsToScene((sourceName: string): string => sourceName + playerEntity.id, true, {doNotInstantiate: true});
        const player = entries.rootNodes[0] as B.Mesh;

        player.scaling.scaleInPlace(0.25);

        const hitbox = new B.Mesh(`hitbox${playerEntity.id}`, this.babylonScene);
        hitbox.metadata = {tag: playerEntity.tag, id: playerEntity.id};
        player.setParent(hitbox);
        player.position = new B.Vector3(0, -1, 0);

        hitbox.position = new B.Vector3(0, 0, -20);

        // player name text
        const playerNameText = new GUI.TextBlock();
        playerNameText.text = this.game.networkInstance.players.find((playerData) => playerData.id === playerId)!.name;
        playerNameText.color = "#ff0000";
        playerNameText.fontSize = 15;
        playerNameText.outlineColor = "black";
        playerNameText.outlineWidth = 5;
        this._gui.addControl(playerNameText);
        playerNameText.linkWithMesh(hitbox);
        playerNameText.linkOffsetY = -60;

        playerEntity.addComponent(new MeshComponent(playerEntity, this, {mesh: hitbox}));
        const playerPhysicsShape = new B.PhysicsShapeBox(
            new B.Vector3(0, 0, 0),
            new B.Quaternion(0, 0, 0, 1),
            new B.Vector3(1, 2, 1),
            this.babylonScene
        );
        playerEntity.addComponent(new RigidBodyComponent(playerEntity, this, {
            physicsShape: playerPhysicsShape,
            physicsProps: {mass: 1},
            massProps: {inertia: new B.Vector3(0, 0, 0)},
            isCollisionCallbackEnabled: true
        }));

        // animations
        const animations: {[key: string]: B.AnimationGroup} = {};
        animations["Idle"] = this._getAnimationGroupByName(`Idle${playerEntity.id}`, entries.animationGroups);
        animations["Running"] = this._getAnimationGroupByName(`Running${playerEntity.id}`, entries.animationGroups);
        animations["Jumping"] = this._getAnimationGroupByName(`Jumping${playerEntity.id}`, entries.animationGroups);
        playerEntity.addComponent(new NetworkAnimationComponent(playerEntity, this, {animations: animations}));

        playerEntity.addComponent(new NetworkPredictionComponent<InputStates>(playerEntity, this, {usePhysics: true}));
        playerEntity.addComponent(new PlayerBehaviour(playerEntity, this, {playerId: playerId}));

        return playerEntity;
    }

    private _createGameManager(): void {
        const description: string = `
            <span class='description-title'>title</span></span><br><br>
            description...
        `;
        const imgSrc: string = "";
        const commands: Commands = [
            {keys: ["z", "q", "s", "d"], description: "Move"},
            {keys: ["space"], description: "Jump"}
        ];

        const gameManager = new Entity("gameManager");
        gameManager.addComponent(new GamePresentation(gameManager, this, {description, imgSrc, commands}));
        gameManager.addComponent(new GameMessages(gameManager, this));
        gameManager.addComponent(new GameTimer(gameManager, this, {duration: 120}));
        gameManager.addComponent(new GameScores(gameManager, this));
        this.entityManager.addEntity(gameManager);
    }

    private _destroyPlayerClientRpc(args: {entityId: string}): void {
        const playerEntity: Entity = this.entityManager.getEntityById(args.entityId);
        this.entityManager.removeEntity(playerEntity);
    }

    private _getAnimationGroupByName(name: string, animationGroups: B.AnimationGroup[]): B.AnimationGroup {
        return animationGroups.find((animationGroup: B.AnimationGroup): boolean => animationGroup.name === name)!;
    }
}