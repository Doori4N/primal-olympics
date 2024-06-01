import {Scene} from "../../core/Scene";
import * as B from '@babylonjs/core';
import {PlayerData} from "../../network/types";
import {NetworkClient} from "../../network/NetworkClient";
import {NetworkHost} from "../../network/NetworkHost";
import {Entity} from "../../core/Entity";
import {Utils} from "../../utils/Utils";
import {MeshComponent} from "../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../core/components/RigidBodyComponent";
import {NetworkAnimationComponent} from "../../network/components/NetworkAnimationComponent";
import {CameraComponent} from "../../core/components/CameraComponent";
import {TRexBeheviour} from "./components/TRexBeheviour";
import {NetworkTransformComponent} from "../../network/components/NetworkTransformComponent";
import {PlayerBehaviour} from "./components/PlayerBehaviour";
import {Commands, InputType} from "../../core/types";
import {GamePresentation} from "../../core/components/GamePresentation";
import {GameMessages} from "../../core/components/GameMessages";
import {Leaderboard} from "../../core/components/Leaderboard";
import {CameraAnimation} from "./components/CameraAnimation";
import {GameController} from "./components/GameController";
import {CameraMovement} from "./components/CameraMovement";
import {GameScores} from "./components/GameScores";

export class TrackAndFieldScene extends Scene {
    constructor() {
        super("T-Rex Track");
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
                    this.game.networkInstance.addEventListener(`onPlayerReady${playerData.id}`, resolve);
                });
            });
            await Promise.all(playerReadyPromises);
        }
        // CLIENT
        else {
            // listen to onCreateEntity events
            this.game.networkInstance.addEventListener("onCreateTRex", this._createTRex.bind(this));
            this.game.networkInstance.addEventListener("onCreatePlayer", (args: {playerData: PlayerData, index: number, entityId: string}): void => {
                this._createPlayer(args.playerData, args.index, args.entityId);
            });
        }

        // load assets
        this.loadedAssets["caveman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "caveman.glb", this.babylonScene);
        this.loadedAssets["cavewoman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "cavewoman.glb", this.babylonScene);
        this.loadedAssets["t-rex"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "t-rex.glb", this.babylonScene);
        this.loadedAssets["map"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/scenes/", "trackScene.glb", this.babylonScene);

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        this.enablePhysics(new B.Vector3(0, -9.81, 0));

        // camera
        this.mainCamera.setTarget(B.Vector3.Zero());
        this.mainCamera.position = new B.Vector3(0, 11, -15);

        // start animation
        const cameraEntity = new Entity();
        const camera = new B.FreeCamera("camera", new B.Vector3(-20, 3, -10), this.babylonScene);
        cameraEntity.addComponent(new CameraComponent(cameraEntity, this, {camera: camera}));
        cameraEntity.addComponent(new CameraAnimation(cameraEntity, this));
        this.entityManager.addEntity(cameraEntity);

        // light
        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.babylonScene);
        light.intensity = 0.7;

        // skybox
        const skybox: B.Mesh = B.MeshBuilder.CreateBox("skyBox", {size:1000.0}, this.babylonScene);
        const skyboxMaterial = new B.StandardMaterial("skyBox", this.babylonScene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new B.CubeTexture("img/skybox", this.babylonScene);
        skyboxMaterial.reflectionTexture.coordinatesMode = B.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new B.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new B.Color3(0, 0, 0);
        skybox.material = skyboxMaterial;

        this._createGround();

        // supporters
        this._createSupporters();

        // gameManager
        const gameManager = this._createGameManagerEntity();
        this.entityManager.addEntity(gameManager);

        // finish line
        const finishLineEntity = new Entity("finishLine");
        const finishBox: B.Mesh = B.MeshBuilder.CreateBox("finishLine", {width: 1, height: 5, depth: 20}, this.babylonScene);
        finishBox.metadata = {tag: finishLineEntity.tag};
        finishBox.position = new B.Vector3(125, 2.5, 8);
        finishBox.isVisible = false;
        finishLineEntity.addComponent(new MeshComponent(finishLineEntity, this, {mesh: finishBox}));
        finishLineEntity.addComponent(new RigidBodyComponent(finishLineEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0},
            isTrigger: true
        }));
        this.entityManager.addEntity(finishLineEntity);

        const finishLine = B.MeshBuilder.CreateCylinder("finishLine", {diameter: 0.3, height: 15}, this.babylonScene);
        finishLine.rotate(B.Axis.X, Math.PI / 2, B.Space.WORLD);
        finishLine.position = new B.Vector3(125, 0.3, 7.5);
        const finishLineMaterial = new B.StandardMaterial("finishLineMaterial", this.babylonScene);
        finishLineMaterial.diffuseColor = new B.Color3(0, 1, 0);
        finishLine.material = finishLineMaterial;

        // CLIENT
        if (!this.game.networkInstance.isHost) {
            // tell the host that the player is ready
            const networkClient = this.game.networkInstance as NetworkClient;
            networkClient.sendToHost(`onPlayerReady${this.game.networkInstance.playerId}`);
        }
        // HOST
        else {
            this._createTRex();
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
            this.game.networkInstance.players.forEach((playerData: PlayerData): void => {
                this.game.networkInstance.removeAllEventListeners(`onPlayerReady${playerData.id}`);
            });
        }

        super.destroy();
    }

    private _createSupporters(): void {
        let supportersContainer: B.AssetContainer;
        const supporterPositions: B.Vector3[] = [
            new B.Vector3(2.83, 1.63, 17.95),
            new B.Vector3(-3.72, 0.98, 15.54),
            new B.Vector3(11.66, 3.52, 19.95),
            new B.Vector3(6.2, 1.63, 16.15),
            new B.Vector3(23.87, 2.46, 19.05),
            new B.Vector3(30.97, 1.44, 19.51),
            new B.Vector3(35.56, 2.73, 20.03),
            new B.Vector3(42, 1.56, 15.35),
            new B.Vector3(46.62, 1.92, 19.37),
            new B.Vector3(55.32, 1.45, 15.43),
            new B.Vector3(62.66, 3.36, 20.07),
            new B.Vector3(69.54, 0.77, 16.17),
            new B.Vector3(77.56, 3.32, 20.15),
            new B.Vector3(86.44, 2.21, 18.85),
            new B.Vector3(96.92, 2.33, 18.32),
            new B.Vector3(103.82, 1.94, 16.19),
            new B.Vector3(14.68, 1.36, 15.77),
            new B.Vector3(19.16, 1.36, 15.77),
            new B.Vector3(68.10, 2.5, 18.39),
            new B.Vector3(83.3, 1.01, 16.07),
            new B.Vector3(100.53, 1.6, 17.86)
        ];

        supporterPositions.forEach((position: B.Vector3): void => {
            const randomIndex: number = Utils.randomInt(0, 1);
            if (randomIndex === 0) supportersContainer = this.loadedAssets["cavewoman"];
            else supportersContainer = this.loadedAssets["caveman"];

            this._duplicateSupporter(supportersContainer, position);
        });
    }

    private _duplicateSupporter(container: B.AssetContainer, position: B.Vector3): void {
        const randomId: string = Utils.randomInt(10000, 20000).toString();
        const entries: B.InstantiatedEntries = container.instantiateModelsToScene((sourceName: string): string => sourceName + randomId, true, {doNotInstantiate: true});
        const supporter = entries.rootNodes[0] as B.Mesh;

        let animation: B.AnimationGroup;
        const randomAnimation: number = Utils.randomInt(0, 1);
        if (randomAnimation === 0) animation = entries.animationGroups.find((animationGroup: B.AnimationGroup): boolean => animationGroup.name === `Idle${randomId}`)!;
        else animation = entries.animationGroups.find((animationGroup: B.AnimationGroup): boolean => animationGroup.name === `Victory${randomId}`)!;
        animation.start(true);

        supporter.scaling.scaleInPlace(0.25);
        supporter.position = position;
        supporter.rotate(B.Axis.Y, Math.PI, B.Space.WORLD);
    }

    private _createGround(): void {
        for (let i: number = 0; i < 3; i++) {
            this._createTrack(new B.Vector3(i * 100.795 - 50, 0, 0));
        }

        const groundEntity = new Entity("ground");
        const ground: B.GroundMesh = B.MeshBuilder.CreateGround("ground", {width: 400, height: 40}, this.babylonScene);
        ground.position.x = 150;
        ground.position.z = 10;
        ground.metadata = {tag: groundEntity.tag};
        ground.isVisible = false;
        groundEntity.addComponent(new MeshComponent(groundEntity, this, {mesh: ground}));
        groundEntity.addComponent(new RigidBodyComponent(groundEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(groundEntity);
    }

    private _createTrack(position: B.Vector3): void {
        const mapContainer: B.AssetContainer = this.loadedAssets["map"];
        const entries: B.InstantiatedEntries = mapContainer.instantiateModelsToScene(undefined, true, {doNotInstantiate: true});
        const mapMesh = entries.rootNodes[0] as B.Mesh;
        mapMesh.scaling.scaleInPlace(0.2);
        mapMesh.rotate(B.Axis.Y, -Math.PI / 2, B.Space.WORLD);
        mapMesh.position = position;
    }

    private _createTRex(entityId?: string): void {
        const trexEntity: Entity = this._createTRexEntity(entityId);
        this.entityManager.addEntity(trexEntity);

        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onCreateTRex", trexEntity.id);
        }
    }

    private _createGameManagerEntity(): Entity {
        const gameManager = new Entity("gameManager");

        const description: string = `
            <span class='description-title'>Run away from the T-Rex before it eats you!</span></span><br>
            <ul>
                <li>To move forward, alternately press the indicated keys as quickly as possible</li>
                <li>Reach the finish line before the T-Rex catches you!</li>
            </ul>
        `;
        const imgSrc: string = "track-and-field-presentation.png";
        let commands: Commands[];
        if (this.game.inputManager.inputStates.type === InputType.GAMEPAD) {
            commands = [
                {keys: ["gamepad_lb", "gamepad_rb"], description: "Run", style: "large-button-img"},
            ];
        }
        else {
            commands = [
                {keys: ["keyboard_q", "keyboard_d"], description: "Run", style: "key-img"},
            ];
        }

        gameManager.addComponent(new GamePresentation(gameManager, this, {description, imgSrc, commands}));
        gameManager.addComponent(new GameMessages(gameManager, this));
        gameManager.addComponent(new Leaderboard(gameManager, this));
        gameManager.addComponent(new GameController(gameManager, this));
        gameManager.addComponent(new GameScores(gameManager, this));

        return gameManager;
    }

    private _initPlayers(): void {
        const networkHost = this.game.networkInstance as NetworkHost;
        for (let i: number = 0; i < networkHost.players.length; i++) {
            const playerData: PlayerData = networkHost.players[i];
            this._createPlayer(playerData, i);
        }
    }

    private _createPlayer(playerData: PlayerData, index: number, entityId?: string): void {
        const playerEntity: Entity = this._createPlayerEntity(playerData, index, entityId);
        this.entityManager.addEntity(playerEntity);

        // HOST
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onCreatePlayer", {playerData: playerData, index: index, entityId: playerEntity.id});
        }
    }

    private _createTRexEntity(entityId?: string): Entity {
        const tRexContainer: B.AssetContainer = this.loadedAssets["t-rex"];
        const tRexEntity = new Entity("t-rex", entityId);

        tRexContainer.addAllToScene();
        const tRex = tRexContainer.meshes[0] as B.Mesh;
        tRex.scaling.scaleInPlace(0.5);

        const hitbox = new B.Mesh(`hitbox${tRexEntity.id}`, this.babylonScene);
        hitbox.metadata = {tag: tRexEntity.tag, id: tRexEntity.id};
        tRex.setParent(hitbox);
        tRex.position = new B.Vector3(0, -4, 0);

        hitbox.rotate(B.Axis.Y, Math.PI / 2, B.Space.WORLD);
        hitbox.position = new B.Vector3(-20, 4, 6.5);

        tRexEntity.addComponent(new MeshComponent(tRexEntity, this, {mesh: hitbox}));

        const playerPhysicsShape = new B.PhysicsShapeBox(
            new B.Vector3(0, 0, 0),
            new B.Quaternion(0, 0, 0, 1),
            new B.Vector3(15, 8, 10),
            this.babylonScene
        );
        tRexEntity.addComponent(new RigidBodyComponent(tRexEntity, this, {
            physicsShape: playerPhysicsShape,
            physicsProps: {mass: 0},
            massProps: {inertia: new B.Vector3(0, 0, 0)},
            isTrigger: true
        }));

        // animations
        const animations: {[key: string]: B.AnimationGroup} = {};
        animations["Attack"] = Utils.getAnimationGroupByName(`Armature|TRex_Attack`, tRexContainer.animationGroups);
        animations["Idle"] = Utils.getAnimationGroupByName(`Armature|TRex_Idle`, tRexContainer.animationGroups);
        animations["Running"] = Utils.getAnimationGroupByName(`Armature|TRex_Run`, tRexContainer.animationGroups);
        tRexEntity.addComponent(new NetworkAnimationComponent(tRexEntity, this, {animations: animations}));

        tRexEntity.addComponent(new NetworkTransformComponent(tRexEntity, this, {usePhysics: true}));
        tRexEntity.addComponent(new TRexBeheviour(tRexEntity, this));

        return tRexEntity;
    }

    private _createPlayerEntity(playerData: PlayerData, index: number, entityId?: string): Entity {
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
        hitbox.position.z = 1.75 * index;
        hitbox.rotate(B.Axis.Y, Math.PI / 2, B.Space.WORLD);

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
            massProps: {inertia: new B.Vector3(0, 0, 0)}
        }));

        // animations
        const animations: {[key: string]: B.AnimationGroup} = {};
        animations["Idle"] = Utils.getAnimationGroupByName(`Idle${playerEntity.id}`, entries.animationGroups);
        animations["Running"] = Utils.getAnimationGroupByName(`Running${playerEntity.id}`, entries.animationGroups);
        animations["Celebration"] = Utils.getAnimationGroupByName(`Victory${playerEntity.id}`, entries.animationGroups);
        animations["Defeat"] = Utils.getAnimationGroupByName(`Defeat${playerEntity.id}`, entries.animationGroups);
        animations["TakeTheL"] = Utils.getAnimationGroupByName(`Loser${playerEntity.id}`, entries.animationGroups);
        animations["Death"] = Utils.getAnimationGroupByName(`Dying${playerEntity.id}`, entries.animationGroups);
        playerEntity.addComponent(new NetworkAnimationComponent(playerEntity, this, {animations: animations}));

        playerEntity.addComponent(new NetworkTransformComponent(playerEntity, this, {usePhysics: true}));
        playerEntity.addComponent(new PlayerBehaviour(playerEntity, this, {playerData: playerData}));

        if (this.game.networkInstance.playerId === playerData.id) {
            // follow camera
            const mainCameraEntity = new Entity("playerCamera");
            mainCameraEntity.addComponent(new CameraComponent(mainCameraEntity, this, {camera: this.mainCamera}));
            mainCameraEntity.addComponent(new CameraMovement(mainCameraEntity, this, {player: playerEntity}))
            this.entityManager.addEntity(mainCameraEntity);
        }

        return playerEntity;
    }
}