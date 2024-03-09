import {Scene} from "../../core/Scene";
import * as B from '@babylonjs/core';
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
import {NetworkMeshComponent} from "../../network/components/NetworkMeshComponent";
import {NetworkAnimationComponent} from "../../network/components/NetworkAnimationComponent";

export class MeteoritesScene extends Scene {
    constructor() {
        super("meteorites");
    }

    public async loadAssets(): Promise<void> {
        this.game.engine.displayLoadingUI();

        // load assets
        this.loadedAssets["player"] = await B.SceneLoader.LoadAssetContainerAsync(
            "https://assets.babylonjs.com/meshes/",
            "HVGirl.glb",
            this.scene
        );

        this.loadedAssets["meteorite"] = await B.SceneLoader.LoadAssetContainerAsync(
            "meshes/",
            "meteorite.glb",
            this.scene
        );

        this.loadedAssets["meteoriteMap"] = await B.SceneLoader.LoadAssetContainerAsync(
            "meshes/",
            "map_meteorite.glb",
            this.scene
        );

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        // Enable physics engine
        const gravityVector = new B.Vector3(0, -9.81, 0);
        this.scene.enablePhysics(gravityVector, this.game.physicsPlugin);

        // camera
        this.mainCamera.position = new B.Vector3(0, 30, -20);
        this.mainCamera.setTarget(B.Vector3.Zero());
        this.mainCamera.attachControl(this.game.canvas, true);
        this.mainCamera.speed = 0.3;

        // start animation
        const cameraEntity = new Entity();
        const camera = new B.FreeCamera("camera", new B.Vector3(0, 3, 15), this.scene);
        camera.rotation.y = Math.PI;
        cameraEntity.addComponent(new CameraComponent(cameraEntity, this, {camera: camera}));
        cameraEntity.addComponent(new CameraAnimation(cameraEntity, this));
        this.entityManager.addEntity(cameraEntity);

        // light
        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;

        // ground
        const groundEntity = new Entity("ground");
        // const mapContainer: B.AssetContainer = this.loadedAssets["meteoriteMap"];
        // mapContainer.addAllToScene();
        // const ground: B.Mesh = mapContainer.meshes[0] as B.Mesh;
        // ground.rotationQuaternion = B.Quaternion.RotationAxis(new B.Vector3(1, 0, 0), Math.PI);
        // ground.scaling.scaleInPlace(2);
        const ground: B.GroundMesh = B.MeshBuilder.CreateGround("ground", {width: 18, height: 18}, this.scene);
        ground.metadata = {tag: groundEntity.tag};
        groundEntity.addComponent(new MeshComponent(groundEntity, this, {mesh: ground}));
        groundEntity.addComponent(new RigidBodyComponent(groundEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(groundEntity);

        // players
        const playerContainer: B.AssetContainer = this.loadedAssets["player"];
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            for (let i: number = 0; i < networkHost.players.length; i++) {
                const playerId: string = networkHost.players[i].id;
                const playerEntity: Entity = this._createPlayer(playerContainer, playerId);
                this.entityManager.addEntity(playerEntity);
                networkHost.sendToAllClients("onCreatePlayer", {playerId: playerId, id: playerEntity.id});
            }
        }
        else {
            this.game.networkInstance.addEventListener("onCreatePlayer", (args: {playerId: string, id: string}): void => {
                const playerEntity: Entity = this._createPlayer(playerContainer, args.playerId, args.id);
                this.entityManager.addEntity(playerEntity);
            });
            this.game.networkInstance.addEventListener("onDestroyPlayer", this._destroyPlayerClientRpc.bind(this));
        }

        // meteorites
        const meteoriteController = new Entity();
        meteoriteController.addComponent(new MeteoriteController(meteoriteController, this));
        this.entityManager.addEntity(meteoriteController);

        //   gameController
        const gameController = new Entity("gameController");
        const htmlTemplate: string = `
            <h1>Stellar Storm</h1>
            <p>PC : Z/Q/S/D to move</p>
            <p>Gamepads : Left joystick to move</p>
            <p>Move your character to dodge meteorites falling from the sky</p>
        `;
        gameController.addComponent(new GamePresentation(gameController, this, {htmlTemplate}));
        gameController.addComponent(new GameMessages(gameController, this));
        gameController.addComponent(new Leaderboard(gameController, this));
        gameController.addComponent(new GameTimer(gameController, this, {duration: 60}));
        gameController.addComponent(new GameScores(gameController, this));
        this.entityManager.addEntity(gameController);
    }

    private _createPlayer(playerContainer: B.AssetContainer, playerId: string, entityId?: string): Entity {
        const playerEntity = new Entity("player", entityId);

        const entries: B.InstantiatedEntries = playerContainer.instantiateModelsToScene((sourceName: string): string => sourceName + playerEntity.id, false, {doNotInstantiate: true});
        const player = entries.rootNodes[0] as B.Mesh;

        player.scaling.scaleInPlace(0.1);

        const hitbox = new B.Mesh(`hitbox${playerEntity.id}`, this.scene);
        hitbox.metadata = {tag: playerEntity.tag, id: playerEntity.id};

        player.setParent(hitbox);
        player.position = new B.Vector3(0.5, 0, 0.5);

        playerEntity.addComponent(new MeshComponent(playerEntity, this, {mesh: hitbox}));

        const animations: {[key: string]: B.AnimationGroup} = {};
        animations["Idle"] = entries.animationGroups[0];
        animations["Walking"] = entries.animationGroups[2];
        playerEntity.addComponent(new NetworkAnimationComponent(playerEntity, this, {animations: animations}));

        const useInterpolation: boolean = playerId !== this.game.networkInstance.playerId;
        playerEntity.addComponent(new NetworkMeshComponent(playerEntity, this, {
            mesh: hitbox,
            interpolate: useInterpolation,
            useSubMeshForRotation: true
        }));

        if (this.game.networkInstance.isHost) {
            const playerPhysicsShape = new B.PhysicsShapeBox(
                new B.Vector3(0.5, 1, 0.5),
                new B.Quaternion(0, 0, 0, 1),
                new B.Vector3(1, 2, 1),
                this.scene
            );
            playerEntity.addComponent(new RigidBodyComponent(playerEntity, this, {
                physicsShape: playerPhysicsShape,
                physicsProps: {mass: 1},
                massProps: {inertia: new B.Vector3(0, 0, 0)},
                isTrigger: false
            }));
        }
        playerEntity.addComponent(new PlayerBehaviour(playerEntity, this, {playerId: playerId}));

        return playerEntity;
    }

    private _destroyPlayerClientRpc(args: {entityId: string}): void {
        const playerEntity: Entity = this.entityManager.getEntityById(args.entityId);
        this.entityManager.destroyEntity(playerEntity);
    }
}