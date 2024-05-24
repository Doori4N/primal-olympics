import * as B from '@babylonjs/core';
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
import { CameraMovement } from './components/CameraMovement';
import {PlayerData} from "../../network/types";
import {NetworkClient} from "../../network/NetworkClient";
import {Utils} from "../../utils/Utils";

export class SlopeScene extends Scene {
    constructor() {
        super("Downhill Madness");
    }

    public async preload(): Promise<void> {
        // HOST
        // wait for all players to be ready
        if (this.game.networkInstance.isHost) {
            const playerReadyPromises: Promise<void>[] = this.game.networkInstance.players.map((playerData: PlayerData): Promise<void> => {
                // if the player is the host, return immediately
                if (playerData.id === this.game.networkInstance.playerId) return Promise.resolve();

                return new Promise<void>((resolve): void => {
                    this.game.networkInstance.addEventListener("onPlayerReady", resolve);
                });
            });
            await Promise.all(playerReadyPromises);
        }
        // CLIENT
        else {
            // listen to onCreateEntity events
            this.game.networkInstance.addEventListener("onCreatePlayer", (args: {playerData: PlayerData, entityId: string}): void => {
                this._createPlayer(args.playerData, args.entityId);
            });
            this.game.networkInstance.addEventListener("onDestroyPlayer", this._destroyPlayerClientRpc.bind(this));

            // tell the host that the player is ready
            const networkClient = this.game.networkInstance as NetworkClient;
            networkClient.sendToHost("onPlayerReady");
        }

        this.game.engine.displayLoadingUI();

        // load assets
        this.loadedAssets["caveman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "caveman.glb", this.babylonScene);
        this.loadedAssets["cavewoman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "cavewoman.glb", this.babylonScene);
        this.loadedAssets["log"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "log.glb", this.babylonScene);
        this.loadedAssets["slopeMap"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/scenes/", "slopeMap.glb", this.babylonScene);
        this.loadedAssets["rock"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "roche.glb", this.babylonScene);

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        this.enablePhysics(new B.Vector3(0, -9.81, 0));

        // camera
        // this.mainCamera.position = new B.Vector3(0, -15, -60);
        // this.mainCamera.setTarget(B.Vector3.Zero());
        // this.mainCamera.attachControl(this.game.canvas, true);
        // this.mainCamera.speed = 0.3;

        //start animation
        const cameraEntity = new Entity();
        const camera = new B.FreeCamera("camera", new B.Vector3(-15, 0, -100), this.babylonScene);
        cameraEntity.addComponent(new CameraComponent(cameraEntity, this, {camera: camera}));
        cameraEntity.addComponent(new CameraAnimation(cameraEntity, this));
        this.entityManager.addEntity(cameraEntity);

        // light
        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.babylonScene);
        light.intensity = 0.7;

        this._createSlope();
        this._createInvisibleWalls(); // pour éviter que les joueurs/objets tombent sur les cotes de la pente

        this._createGameManager();

        // falling objects
        const fallingObjectController = new Entity();
        fallingObjectController.addComponent(new FallingObjectController(fallingObjectController, this));
        this.entityManager.addEntity(fallingObjectController);

        // finish line
        this._createFinishLine();

        if (!this.game.networkInstance.isHost) return;

        // HOST
        this._initPlayers();
    }

    private _createInvisibleWalls(): void {
        // Dimensions et la position des murs
        const wallHeight = 15;
        const wallDepth = 1;
        const wallWidth = 130;
        const wallOffset = 16; // Distance par rapport au centre de la pente
        const slopeInclination = -Math.PI / 10; // Inclinaison de la pente
    
        // Mur gauche
        const leftWall = new Entity("leftWall");
        const leftWallMesh = B.MeshBuilder.CreateBox("leftWall", {width: wallDepth, height: wallHeight, depth: wallWidth}, this.babylonScene);
        leftWallMesh.position = new B.Vector3(-wallOffset - 1, wallHeight / 2, -0.40);
        leftWallMesh.rotation = new B.Vector3(slopeInclination, 0, 0); // Incliner le mur gauche
        leftWallMesh.visibility = 0; // Rendre le mur invisible
        leftWallMesh.metadata = {tag: leftWall.tag};
        leftWall.addComponent(new MeshComponent(leftWall, this, {mesh: leftWallMesh}));
        leftWall.addComponent(new RigidBodyComponent(leftWall, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(leftWall);
    
        // Mur droit
        const rightWall = new Entity("rightWall");
        const rightWallMesh = B.MeshBuilder.CreateBox("rightWall", {width: wallDepth, height: wallHeight, depth: wallWidth}, this.babylonScene);
        rightWallMesh.position = new B.Vector3(wallOffset - 0.3, wallHeight / 2, -0.40);
        rightWallMesh.rotation = new B.Vector3(slopeInclination, 0, 0); // Incliner le mur droit dans le sens opposé
        rightWallMesh.visibility = 0; // Rendre le mur invisible
        rightWallMesh.metadata = {tag: rightWall.tag};
        rightWall.addComponent(new MeshComponent(rightWall, this, {mesh: rightWallMesh}));
        rightWall.addComponent(new RigidBodyComponent(rightWall, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(rightWall);

        // Mur arrière
        const backWall = new Entity("backWall");
        const backWallMesh = B.MeshBuilder.CreateBox("backWall", {width: 40, height: wallHeight, depth: wallDepth}, this.babylonScene);
        backWallMesh.position = new B.Vector3(0, -6, -55);
        backWallMesh.metadata = {tag: backWall.tag};
        backWallMesh.visibility = 0; // Rendre le mur invisible
        backWall.addComponent(new MeshComponent(backWall, this, {mesh: backWallMesh}));
        backWall.addComponent(new RigidBodyComponent(backWall, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
    }
    
    private _createSlope(): void {
        const slopeEntity = new Entity("slope");

        const mapContainer: B.AssetContainer = this.loadedAssets["slopeMap"];
        mapContainer.addAllToScene();
        const slopeMap: B.Mesh = mapContainer.meshes[0] as B.Mesh;
        //console.log(mapContainer.meshes);
        //console.log(mapContainer.meshes[1] as B.Mesh); // terrain
        mapContainer.meshes.forEach((mesh: B.AbstractMesh): void => {
            mesh.receiveShadows = true;
        });

        slopeMap.scaling = new B.Vector3(0.40, 0.75, 1);
        slopeMap.rotation = new B.Vector3(0, -Math.PI / 2, 0);
        slopeMap.position = new B.Vector3(0, -7, 0);
        slopeMap.position.z = -30;

        const slopeMesh: B.Mesh = B.MeshBuilder.CreateGround("ground", {width: 34, height: 135.5}, this.babylonScene);
        slopeMesh.rotation = new B.Vector3(-Math.PI / 10 - 0.123, 0, 0); // -Math.PI / 14 ou -Math.PI / 12 voir les potos
        slopeMesh.position.z = -2;
        slopeMesh.position.y = 4;

        slopeMesh.metadata = {tag: slopeEntity.tag};
        slopeMesh.isVisible = false;
        slopeMap.setParent(slopeMesh);

        slopeMesh.metadata = {tag: slopeEntity.tag};
        slopeEntity.addComponent(new MeshComponent(slopeEntity, this, {mesh: slopeMesh}));
        slopeEntity.addComponent(new RigidBodyComponent(slopeEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(slopeEntity);

        this._createPlatform();
    }

    private _createPlatform(): void {
        const platformEntity = new Entity("platform");

        const platformMesh: B.Mesh = B.MeshBuilder.CreateGround("platform", {width: 40, height: 27}, this.babylonScene);
        platformMesh.position = new B.Vector3(0, -14.5, -56); 

        platformMesh.isVisible = false;

        platformMesh.metadata = {tag: platformEntity.tag};
        platformEntity.addComponent(new MeshComponent(platformEntity, this, {mesh: platformMesh}));
        platformEntity.addComponent(new RigidBodyComponent(platformEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));

        this.entityManager.addEntity(platformEntity);
    }

    private _createFinishLine(): void {
        const finishLine = new Entity("finishLine");
        const finishLineMesh: B.Mesh = B.MeshBuilder.CreateBox("finishLine", {width: 35, height: 10, depth: 1}, this.babylonScene);
        finishLineMesh.position = new B.Vector3(0, 35, 60);
        finishLineMesh.metadata = {tag: finishLine.tag};
        finishLineMesh.isVisible = false;
        finishLine.addComponent(new MeshComponent(finishLine, this, {mesh: finishLineMesh}));
        finishLine.addComponent(new RigidBodyComponent(finishLine, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0},
            isTrigger: true
        }));
        this.entityManager.addEntity(finishLine);
    }


    private _initPlayers(): void {
        const networkHost = this.game.networkInstance as NetworkHost;
        for (let i: number = 0; i < networkHost.players.length; i++) {
            const playerData: PlayerData = networkHost.players[i];
            this._createPlayer(playerData);
        }
    }

    private _createPlayer(playerData: PlayerData, entityId?: string): void {
        const playerEntity: Entity = this._createPlayerEntity(playerData, entityId);
        this.entityManager.addEntity(playerEntity);

        // HOST
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onCreatePlayer", {playerData: playerData, entityId: playerEntity.id});
        }
    }

    private _createPlayerEntity(playerData: PlayerData, entityId?: string): Entity {
        let playerContainer: B.AssetContainer;
        if (playerData.skinOptions.modelIndex === 0) {
            playerContainer = this.loadedAssets["caveman"];
        }
        else {
            playerContainer = this.loadedAssets["cavewoman"];
        }
        const playerEntity = new Entity("player", entityId);

        const entries: B.InstantiatedEntries = playerContainer.instantiateModelsToScene((sourceName: string): string => sourceName + playerEntity.id, true, {doNotInstantiate: true});
        const player = entries.rootNodes[0] as B.Mesh;

        player.scaling.scaleInPlace(0.25);

        const hitbox = new B.Mesh(`hitbox${playerEntity.id}`, this.babylonScene);
        hitbox.metadata = {tag: playerEntity.tag, id: playerEntity.id};
        player.setParent(hitbox);
        player.position = new B.Vector3(0, -1, 0);

        hitbox.position = new B.Vector3(0, 0, -50);

        // player skin colors
        Utils.applyColorsToMesh(player, playerData.skinOptions);

        playerEntity.addComponent(new MeshComponent(playerEntity, this, {mesh: hitbox}));
        const playerPhysicsShape = new B.PhysicsShapeBox(
            new B.Vector3(0, 0, 0),
            new B.Quaternion(0, 0, 0, 1),
            new B.Vector3(1, 2, 1),
            this.babylonScene
        );
        playerEntity.addComponent(new RigidBodyComponent(playerEntity, this, {
            physicsShape: playerPhysicsShape,
            physicsProps: {mass: 1}, // si on baisse le perso glisse moins mais on doit garder de la masse pour le saut 
            massProps: {inertia: new B.Vector3(0, 0, 0)},
            isCollisionCallbackEnabled: true
        }));

        // animations
        const animations: {[key: string]: B.AnimationGroup} = {};
        animations["Idle"] = Utils.getAnimationGroupByName(`Idle${playerEntity.id}`, entries.animationGroups);
        animations["Running"] = Utils.getAnimationGroupByName(`Running${playerEntity.id}`, entries.animationGroups);
        animations["Jumping"] = Utils.getAnimationGroupByName(`Jumping${playerEntity.id}`, entries.animationGroups);
        playerEntity.addComponent(new NetworkAnimationComponent(playerEntity, this, {animations: animations}));

        playerEntity.addComponent(new NetworkPredictionComponent<InputStates>(playerEntity, this, {usePhysics: true}));
        playerEntity.addComponent(new PlayerBehaviour(playerEntity, this, {playerData: playerData}));

        // Constructing a Follow Camera
        if (this.game.networkInstance.playerId === playerData.id) {
            // follow camera
            const mainCameraEntity = new Entity("camera");
            mainCameraEntity.addComponent(new CameraComponent(mainCameraEntity, this, {camera: this.mainCamera}));
            mainCameraEntity.addComponent(new CameraMovement(mainCameraEntity, this, {player: playerEntity}));
            this.entityManager.addEntity(mainCameraEntity);
        }

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
}