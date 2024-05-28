import * as B from '@babylonjs/core';
import {LavaMaterial} from '@babylonjs/materials';
import {Scene} from "../../core/Scene";
import {Entity} from "../../core/Entity";
import {GamePresentation} from "../../core/components/GamePresentation";
import {GameMessages} from "../../core/components/GameMessages";
import {Leaderboard} from "../../core/components/Leaderboard";
import {MeshComponent} from "../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../core/components/RigidBodyComponent";
import {PlayerBehaviour} from "./components/PlayerBehaviour";
import {MeteoriteController} from "./components/MeteoriteController";
import {GameTimer} from "../../core/components/GameTimer";
import {CameraComponent} from "../../core/components/CameraComponent";
import {CameraAnimation} from "./components/CameraAnimation";
import {GameScores} from "./components/GameScores";
import {NetworkHost} from "../../network/NetworkHost";
import {NetworkAnimationComponent} from "../../network/components/NetworkAnimationComponent";
import {Commands, InputStates} from "../../core/types";
import {NetworkClient} from "../../network/NetworkClient";
import {PlayerData} from "../../network/types";
import {Utils} from "../../utils/Utils";
import {NetworkPredictionComponent} from "../../network/components/NetworkPredictionComponent";
import {CameraMovement} from "./components/CameraMovement";

export class MeteoritesScene extends Scene {
    constructor() {
        super("Stellar Storm");
    }

    public async preload(): Promise<void> {
        this.game.engine.displayLoadingUI();

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
        }

        // load assets
        this.loadedAssets["caveman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "caveman.glb", this.babylonScene);
        this.loadedAssets["cavewoman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "cavewoman.glb", this.babylonScene);
        this.loadedAssets["meteorite"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "meteorite.glb", this.babylonScene);
        this.loadedAssets["meteoriteMap"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/scenes/", "meteoriteScene.glb", this.babylonScene);

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        this.enablePhysics(new B.Vector3(0, -9.81, 0));

        // camera
        this.mainCamera.position = new B.Vector3(0, 15, -25);
        this.mainCamera.setTarget(B.Vector3.Zero());
        this.mainCamera.speed = 0.3;

        // start animation
        const cameraEntity = new Entity();
        const camera = new B.FreeCamera("camera", new B.Vector3(0, 3, 15), this.babylonScene);
        camera.rotation.y = Math.PI;
        cameraEntity.addComponent(new CameraComponent(cameraEntity, this, {camera: camera}));
        cameraEntity.addComponent(new CameraAnimation(cameraEntity, this));
        this.entityManager.addEntity(cameraEntity);

        // light
        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.babylonScene);
        light.intensity = 0.7;

        // ground
        const groundContainer: B.AssetContainer = this.loadedAssets["meteoriteMap"];
        groundContainer.addAllToScene();
        const groundMesh: B.Mesh = groundContainer.meshes[0] as B.Mesh;
        groundMesh.scaling.scaleInPlace(.35);
        groundMesh.position.y = -6.8;
        groundMesh.rotate(B.Axis.Y, 2.35, B.Space.WORLD);

        const groundEntity = new Entity("ground");
        const ground: B.Mesh = B.MeshBuilder.CreateDisc("ground", {radius: 16, tessellation: 8}, this.babylonScene);
        ground.isVisible = false;
        ground.rotation.x = Math.PI / 2;
        ground.metadata = {tag: groundEntity.tag};
        groundEntity.addComponent(new MeshComponent(groundEntity, this, {mesh: ground}));
        groundEntity.addComponent(new RigidBodyComponent(groundEntity, this, {
            physicsShape: B.PhysicsShapeType.CONVEX_HULL,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(groundEntity);

        // lava ground
        const lavaGroundEntity = new Entity("lavaGround");
        const lavaGround: B.Mesh = B.MeshBuilder.CreateGround("lavaGround", {width: 800, height: 800, subdivisions: 50}, this.babylonScene);
        lavaGround.position.y = -6;
        lavaGround.scaling.scaleInPlace(.2);
        lavaGround.metadata = {tag: lavaGroundEntity.tag};

        const lavaMaterial = new LavaMaterial("lavaMaterial", this.babylonScene);
        lavaMaterial.noiseTexture = new B.Texture("/img/cloud.png", this.babylonScene);
        lavaMaterial.diffuseTexture = new B.Texture("/img/lavatile.jpg", this.babylonScene);
        lavaMaterial.speed = .4;
        lavaMaterial.fogColor = new B.Color3(.6, 0, 0);

        lavaGround.material = lavaMaterial;

        lavaGroundEntity.addComponent(new MeshComponent(lavaGroundEntity, this, {mesh: lavaGround}));
        lavaGroundEntity.addComponent(new RigidBodyComponent(lavaGroundEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(lavaGroundEntity);

        this.game.soundManager.playSound("lava", {fade: {from: 0, duration: 5000}});

        // meteorites
        const meteoriteController = new Entity();
        meteoriteController.addComponent(new MeteoriteController(meteoriteController, this));
        this.entityManager.addEntity(meteoriteController);

        // gameManager
        const gameManager = this._createGameManagerEntity();
        this.entityManager.addEntity(gameManager);

        // CLIENT
        if (!this.game.networkInstance.isHost) {
            // tell the host that the player is ready
            const networkClient = this.game.networkInstance as NetworkClient;
            networkClient.sendToHost("onPlayerReady");
        }
        // HOST
        else {
            this._initPlayers();
        }
    }

    public destroy(): void {
        // CLIENT
        if (!this.game.networkInstance.isHost) {
            this.game.networkInstance.removeAllEventListeners("onCreatePlayer");
        }
        // HOST
        else {
            this.game.networkInstance.removeAllEventListeners("onPlayerReady");
        }

        super.destroy();
    }

    private _createGameManagerEntity(): Entity {
        const gameManager = new Entity("gameManager");

        const description: string = `
            <span class='description-title'>Dodge the meteorites falling from the sky!</span></span><br>
            <ul>
                <li>Move your character to dodge meteorites falling from the sky</li>
                <li>Push other players into the meteorites to eliminate them</li>
            </ul>
        `;
        const imgSrc: string = "meteorites-presentation.png";
        const commands: Commands = [
            {keys: ["z", "q", "s", "d"], description: "Move"},
            {keys: ["space"], description: "Push"}
        ];

        gameManager.addComponent(new GamePresentation(gameManager, this, {description, imgSrc, commands}));
        gameManager.addComponent(new GameMessages(gameManager, this));
        gameManager.addComponent(new Leaderboard(gameManager, this));
        gameManager.addComponent(new GameTimer(gameManager, this, {duration: 120}));
        gameManager.addComponent(new GameScores(gameManager, this));

        return gameManager;
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

        hitbox.position.y = 1;

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
            physicsProps: {mass: 1},
            massProps: {inertia: new B.Vector3(0, 0, 0)},
            isCollisionCallbackEnabled: true
        }));

        // animations
        const animations: {[key: string]: B.AnimationGroup} = {};
        animations["Idle"] = Utils.getAnimationGroupByName(`Idle${playerEntity.id}`, entries.animationGroups);
        animations["Running"] = Utils.getAnimationGroupByName(`Running${playerEntity.id}`, entries.animationGroups);
        animations["Jump"] = Utils.getAnimationGroupByName(`Jumping${playerEntity.id}`, entries.animationGroups);
        animations["Push_Reaction"] = Utils.getAnimationGroupByName(`Soccer_Tackle_React${playerEntity.id}`, entries.animationGroups);
        animations["Celebration"] = Utils.getAnimationGroupByName(`Victory${playerEntity.id}`, entries.animationGroups);
        animations["Defeat"] = Utils.getAnimationGroupByName(`Defeat${playerEntity.id}`, entries.animationGroups);
        animations["TakeTheL"] = Utils.getAnimationGroupByName(`Loser${playerEntity.id}`, entries.animationGroups);
        animations["Push"] = Utils.getAnimationGroupByName(`CrossPunch${playerEntity.id}`, entries.animationGroups);
        animations["Death"] = Utils.getAnimationGroupByName(`Dying${playerEntity.id}`, entries.animationGroups);
        playerEntity.addComponent(new NetworkAnimationComponent(playerEntity, this, {animations: animations}));

        playerEntity.addComponent(new NetworkPredictionComponent<InputStates>(playerEntity, this, {usePhysics: true}));
        playerEntity.addComponent(new PlayerBehaviour(playerEntity, this, {playerData: playerData}));

        if (this.game.networkInstance.playerId === playerData.id) {
            // follow camera
            const mainCameraEntity = new Entity("playerCamera");
            mainCameraEntity.addComponent(new CameraComponent(mainCameraEntity, this, {camera: this.mainCamera}));
            mainCameraEntity.addComponent(new CameraMovement(mainCameraEntity, this, {player: playerEntity}));
            this.entityManager.addEntity(mainCameraEntity);
        }

        return playerEntity;
    }
}