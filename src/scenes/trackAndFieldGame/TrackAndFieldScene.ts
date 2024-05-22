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
import {Commands} from "../../core/types";
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
            this.game.networkInstance.addEventListener("onCreateTRex", this._createTRex.bind(this));
            this.game.networkInstance.addEventListener("onCreatePlayer", (args: {playerData: PlayerData, entityId: string}): void => {
                this._createPlayer(args.playerData, args.entityId);
            });

            // tell the host that the player is ready
            const networkClient = this.game.networkInstance as NetworkClient;
            networkClient.sendToHost("onPlayerReady");
        }

        this.game.engine.displayLoadingUI();

        // load assets
        this.loadedAssets["caveman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "caveman.glb", this.babylonScene);
        this.loadedAssets["cavewoman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "cavewoman.glb", this.babylonScene);
        this.loadedAssets["t-rex"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "t-rex.glb", this.babylonScene);

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        this.enablePhysics(new B.Vector3(0, -9.81, 0));

        // camera
        this.mainCamera.setTarget(B.Vector3.Zero());
        this.mainCamera.attachControl(this.game.canvas, true);
        this.mainCamera.position = new B.Vector3(0, 10, -20);

        // start animation
        const cameraEntity = new Entity();
        const camera = new B.FreeCamera("camera", new B.Vector3(-20, 3, -10), this.babylonScene);
        cameraEntity.addComponent(new CameraComponent(cameraEntity, this, {camera: camera}));
        cameraEntity.addComponent(new CameraAnimation(cameraEntity, this));
        this.entityManager.addEntity(cameraEntity);

        // light
        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.babylonScene);
        light.intensity = 0.7;

        // ground
        const groundEntity = new Entity("ground");
        const ground: B.GroundMesh = B.MeshBuilder.CreateGround("ground", {width: 60, height: 15}, this.babylonScene);
        ground.metadata = {tag: groundEntity.tag};
        groundEntity.addComponent(new MeshComponent(groundEntity, this, {mesh: ground}));
        groundEntity.addComponent(new RigidBodyComponent(groundEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(groundEntity);

        // gameManager
        const gameManager = this._createGameManagerEntity();
        this.entityManager.addEntity(gameManager);

        // finish line
        const finishLineEntity = new Entity("finishLine");
        const finishLine: B.Mesh = B.MeshBuilder.CreateBox("finishLine", {width: 1, height: 5, depth: 15}, this.babylonScene);
        finishLine.metadata = {tag: finishLineEntity.tag};
        finishLine.position = new B.Vector3(20, 2.5, 0);
        finishLineEntity.addComponent(new MeshComponent(finishLineEntity, this, {mesh: finishLine}));
        finishLineEntity.addComponent(new RigidBodyComponent(finishLineEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0},
            isTrigger: true
        }));
        this.entityManager.addEntity(finishLineEntity);

        if (!this.game.networkInstance.isHost) return;

        // HOST
        this._createTRex();
        this._initPlayers();
    }

    private _createTRex(entityId?: string): void {
        const ballEntity: Entity = this._createTRexEntity(entityId);
        this.entityManager.addEntity(ballEntity);

        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onCreateTRex", ballEntity.id);
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
        const commands: Commands = [
            {keys: ["q", "d"], description: "Run"},
        ];

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
        hitbox.position = new B.Vector3(-20, 4, 0);

        tRexEntity.addComponent(new MeshComponent(tRexEntity, this, {mesh: hitbox}));

        const playerPhysicsShape = new B.PhysicsShapeBox(
            new B.Vector3(0, 0, 0),
            new B.Quaternion(0, 0, 0, 1),
            new B.Vector3(10, 8, 10),
            this.babylonScene
        );
        tRexEntity.addComponent(new RigidBodyComponent(tRexEntity, this, {
            physicsShape: playerPhysicsShape,
            physicsProps: {mass: 0},
            massProps: {inertia: new B.Vector3(0, 0, 0)},
            isTrigger: true
        }));

        const animations: {[key: string]: B.AnimationGroup} = {};
        animations["Attack"] = Utils.getAnimationGroupByName(`Armature|TRex_Attack`, tRexContainer.animationGroups);
        animations["Idle"] = Utils.getAnimationGroupByName(`Armature|TRex_Idle`, tRexContainer.animationGroups);
        animations["Running"] = Utils.getAnimationGroupByName(`Armature|TRex_Run`, tRexContainer.animationGroups);
        tRexEntity.addComponent(new NetworkAnimationComponent(tRexEntity, this, {animations: animations}));

        tRexEntity.addComponent(new TRexBeheviour(tRexEntity, this));

        return tRexEntity;
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
        playerEntity.addComponent(new NetworkAnimationComponent(playerEntity, this, {animations: animations}));

        playerEntity.addComponent(new NetworkTransformComponent(playerEntity, this, {usePhysics: true}));
        playerEntity.addComponent(new PlayerBehaviour(playerEntity, this, {playerData: playerData}));

        if (this.game.networkInstance.playerId === playerData.id) {
            // follow camera
            const mainCameraEntity = new Entity("camera");
            mainCameraEntity.addComponent(new CameraComponent(mainCameraEntity, this, {camera: this.mainCamera}));
            mainCameraEntity.addComponent(new CameraMovement(mainCameraEntity, this, {player: playerEntity}))
            this.entityManager.addEntity(mainCameraEntity);
        }

        return playerEntity;
    }
}