import {Scene} from "../../core/Scene";
import * as B from '@babylonjs/core';
import {Entity} from "../../core/Entity";
import {MeshComponent} from "../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../core/components/RigidBodyComponent";
import {NetworkAnimationComponent} from "../../network/components/NetworkAnimationComponent";
import {PlayerBehaviour} from "./components/PlayerBehaviour";
import {GameController} from "./components/GameController";
import {GameMessages} from "../../core/components/GameMessages";
import {NetworkHost} from "../../network/NetworkHost";
import {BallBehaviour} from "./components/BallBehaviour";
import {NetworkPredictionComponent} from "../../network/components/NetworkPredictionComponent";
import {InputStates} from "../../core/types";
import {GamePresentation} from "../../core/components/GamePresentation";
import {Utils} from "../../utils/Utils";
import {CameraComponent} from "../../core/components/CameraComponent";
import {CameraAnimation} from "./components/CameraAnimation";
import {GameTimer} from "../../core/components/GameTimer";
import * as GUI from "@babylonjs/gui";
import {CameraMovement} from "./components/CameraMovement";

export class FootballScene extends Scene {
    private _ballMesh!: B.Mesh;
    private _spawns: B.Vector3[] = [
        new B.Vector3(5, 1, 5),
        new B.Vector3(5, 1, -5),
        new B.Vector3(10, 1, 5),
        new B.Vector3(10, 1, -5)
    ];
    private _teams: Entity[][] = [[], []];
    private _teamColors = [
        {
            albedoColor: new B.Color3(0.1, 1, 1),
            emissiveColor: new B.Color3(0, 0, 0.1)
        },
        {
            albedoColor: new B.Color3(1, 1, 1),
            emissiveColor: new B.Color3(0, 0, 0)
        }
    ];
    private _gui!: GUI.AdvancedDynamicTexture;
    private _pitchWidth: number = 40;
    private _pitchHeight: number = 20;

    constructor() {
        super("football");
    }

    public async loadAssets(): Promise<void> {
        this.game.engine.displayLoadingUI();

        // load assets
        this.loadedAssets["player"] = await B.SceneLoader.LoadAssetContainerAsync(
            "meshes/",
            "caveman.glb",
            this.babylonScene
        );

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        this.enablePhysics(new B.Vector3(0, -9.81, 0));

        // camera
        this.mainCamera.position = new B.Vector3(0, 17, -15);
        this.mainCamera.setTarget(B.Vector3.Zero());
        this.mainCamera.attachControl(this.game.canvas, true);

        const mainCameraEntity = new Entity("camera");
        mainCameraEntity.addComponent(new CameraComponent(mainCameraEntity, this, {camera: this.mainCamera}));
        mainCameraEntity.addComponent(new CameraMovement(mainCameraEntity, this));
        this.entityManager.addEntity(mainCameraEntity);

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

        // ground
        const groundEntity = new Entity("ground");
        const ground: B.GroundMesh = B.MeshBuilder.CreateGround("ground", {width: this._pitchWidth, height: this._pitchHeight}, this.babylonScene);
        ground.metadata = {tag: groundEntity.tag};
        groundEntity.addComponent(new MeshComponent(groundEntity, this, {mesh: ground}));
        groundEntity.addComponent(new RigidBodyComponent(groundEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(groundEntity);

        // ball
        this._initBall();

        // players
        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.babylonScene);
        this._initPlayers();

        // goals
        this._createGoal("leftGoal", new B.Vector3(-this._pitchWidth / 2, 1.5, 0));
        this._createGoal("rightGoal", new B.Vector3(this._pitchWidth / 2, 1.5, 0));

        // edges
        this._createEdge(new B.Vector3(0, 1.5, (this._pitchHeight / 2) + 0.5), new B.Vector3(0, 0, 0), this._pitchWidth);
        this._createEdge(new B.Vector3(0, 1.5, (-this._pitchHeight / 2) - 0.5), new B.Vector3(0, 0, 0), this._pitchWidth);
        this._createEdge(new B.Vector3((this._pitchWidth / 2) + 0.5, 1.5, 0), new B.Vector3(0, Math.PI / 2, 0), this._pitchHeight);
        this._createEdge(new B.Vector3((-this._pitchWidth / 2) - 0.5, 1.5, 0), new B.Vector3(0, Math.PI / 2, 0), this._pitchHeight);

        // gameManager
        this._initGameManager();

        this.eventManager.subscribe("onGoalScored", this._onGoalScored.bind(this));
    }

    private _initBall(): void {
        // HOST
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            const ballEntity: Entity = this._createBall();
            this.entityManager.addEntity(ballEntity);
            networkHost.sendToAllClients("onCreateBall", {id: ballEntity.id});
        }
        // CLIENT
        else {
            this.game.networkInstance.addEventListener("onCreateBall", (args: {id: string}): void => {
                const ballEntity: Entity = this._createBall(args.id);
                this.entityManager.addEntity(ballEntity);
            });
        }
    }

    private _initPlayers(): void {
        const playerContainer: B.AssetContainer = this.loadedAssets["player"];
        // HOST
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;

            // shuffle teams index
            let teamIndex: number[] = new Array(networkHost.players.length).fill(0, 0, networkHost.players.length / 2).fill(1, networkHost.players.length / 2);
            Utils.shuffle(teamIndex);

            for (let i: number = 0; i < networkHost.players.length; i++) {
                const playerId: string = networkHost.players[i].id;

                const spawnIndex: number = this._teams[teamIndex[i]].length;
                const spawnPosition: B.Vector3 = this._spawns[spawnIndex].clone();
                spawnPosition.x *= teamIndex[i] === 0 ? -1 : 1;

                const playerEntity: Entity = this._createPlayer(playerContainer, playerId, teamIndex[i], spawnPosition);
                this.entityManager.addEntity(playerEntity);

                networkHost.sendToAllClients("onCreatePlayer", {
                    playerId: playerId,
                    id: playerEntity.id,
                    teamIndex: teamIndex[i]
                });

                this._teams[teamIndex[i]].push(playerEntity);
            }
        }
        // CLIENT
        else {
            this.game.networkInstance.addEventListener("onCreatePlayer", (args: {playerId: string, id: string, teamIndex: number}): void => {
                const playerEntity: Entity = this._createPlayer(playerContainer, args.playerId, args.teamIndex, B.Vector3.Zero(), args.id);
                this.entityManager.addEntity(playerEntity);
            });
        }
    }

    private _initGameManager(): void {
        const gameManager = new Entity("gameManager");
        const htmlTemplate: string = `
            <h1>Savage Soccer</h1>
            <p>PC : Z/Q/S/D to move</p>
            <p>PC : Space to shoot/tackle</p>
            <p>PC : Shift to pass</p>
            <p>Gamepads : Left joystick to move</p>
            <p>Gamepads : A to shoot/tackle</p>
            <p>Gamepads : B to pass</p>
            <p>Put the ball in the opponent's net!</p>
        `;
        gameManager.addComponent(new GamePresentation(gameManager, this, {htmlTemplate}));
        gameManager.addComponent(new GameMessages(gameManager, this));
        gameManager.addComponent(new GameTimer(gameManager, this, {duration: 120}));
        gameManager.addComponent(new GameController(gameManager, this));
        this.entityManager.addEntity(gameManager);
    }

    private _createEdge(edgePosition: B.Vector3, edgeRotation: B.Vector3, width: number): void {
        const edgeEntity = new Entity("edge");
        const edgeMesh: B.Mesh = B.MeshBuilder.CreateBox("edge", {width: width, height: 3, depth: 1}, this.babylonScene);
        edgeMesh.isVisible = false;
        edgeMesh.position = edgePosition;
        edgeMesh.rotation = edgeRotation;
        edgeEntity.addComponent(new MeshComponent(edgeEntity, this, {mesh: edgeMesh}));
        edgeEntity.addComponent(new RigidBodyComponent(edgeEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0, restitution: 0.9},
        }));
        this.entityManager.addEntity(edgeEntity);
    }

    private _createGoal(goalName: string, goalPosition: B.Vector3): void {
        const goalEntity = new Entity(`${goalName}`);
        const goalMesh: B.Mesh = B.MeshBuilder.CreateBox(`${goalName}`, {width: 1, height: 3, depth: 6}, this.babylonScene);
        goalMesh.position = goalPosition;
        goalMesh.metadata = {tag: goalEntity.tag};
        goalEntity.addComponent(new MeshComponent(goalEntity, this, {mesh: goalMesh}));
        goalEntity.addComponent(new RigidBodyComponent(goalEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0},
            isTrigger: true
        }));
    }

    private _createPlayer(playerContainer: B.AssetContainer, playerId: string, teamIndex: number, position: B.Vector3, entityId?: string): Entity {
        const playerEntity = new Entity("player", entityId);

        const entries: B.InstantiatedEntries = playerContainer.instantiateModelsToScene((sourceName: string): string => sourceName + playerEntity.id, true, {doNotInstantiate: true});
        const player = entries.rootNodes[0] as B.Mesh;

        const outfitMaterial = player.getChildMeshes()[1].material as B.PBRMaterial;
        outfitMaterial.albedoColor = this._teamColors[teamIndex].albedoColor;
        outfitMaterial.emissiveColor = this._teamColors[teamIndex].emissiveColor;

        player.scaling.scaleInPlace(0.25);

        const hitbox = new B.Mesh(`hitbox${playerEntity.id}`, this.babylonScene);
        hitbox.metadata = {tag: playerEntity.tag, id: playerEntity.id};
        player.setParent(hitbox);
        player.position = new B.Vector3(0, -1, 0);
        hitbox.position = position;

        // player name text
        const playerNameText = new GUI.TextBlock();
        playerNameText.text = this.game.networkInstance.players.find((playerData) => playerData.id === playerId)!.name;
        playerNameText.color = (teamIndex === 0) ? "#0000ff" : "#ff0000"
        playerNameText.fontSize = 14;
        // playerNameText.outlineColor = "black";
        // playerNameText.outlineWidth = 3;
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

        const animations: {[key: string]: B.AnimationGroup} = {};
        animations["Idle"] = entries.animationGroups[0];
        animations["Running"] = entries.animationGroups[2];
        animations["Kicking"] = entries.animationGroups[3];
        animations["Tackling"] = entries.animationGroups[4];
        playerEntity.addComponent(new NetworkAnimationComponent(playerEntity, this, {animations: animations}));

        playerEntity.addComponent(new NetworkPredictionComponent<InputStates>(playerEntity, this, {usePhysics: true}));
        playerEntity.addComponent(new PlayerBehaviour(playerEntity, this, {playerId: playerId, teamIndex: teamIndex}));

        return playerEntity;
    }

    private _createBall(entityId?: string): Entity {
        const ballEntity = new Entity("ball", entityId);

        this._ballMesh = B.MeshBuilder.CreateSphere("ball", {diameter: 1}, this.babylonScene);
        this._ballMesh.position = new B.Vector3(0, 0.5, 0);
        this._ballMesh.metadata = {tag: ballEntity.tag, id: ballEntity.id};

        ballEntity.addComponent(new MeshComponent(ballEntity, this, {mesh: this._ballMesh}));
        ballEntity.addComponent(new RigidBodyComponent(ballEntity, this, {
            physicsShape: B.PhysicsShapeType.SPHERE,
            physicsProps: {mass: 1},
            massProps: {inertia: new B.Vector3(0, 0, 0)}
        }));

        ballEntity.addComponent(new NetworkPredictionComponent<B.Vector3>(ballEntity, this, {usePhysics: true}));
        ballEntity.addComponent(new BallBehaviour(ballEntity, this));

        return ballEntity;
    }

    private _onGoalScored(): void {
        this._ballMesh.position = new B.Vector3(0, 0.5, 0);

        // reset players position
        this._teams[0].forEach((player: Entity, index: number): void => {
            const playerMeshComponent = player.getComponent("Mesh") as MeshComponent;
            playerMeshComponent.mesh.position = this._spawns[index].clone();
            playerMeshComponent.mesh.position.x *= -1;
        });
        this._teams[1].forEach((player: Entity, index: number): void => {
            const playerMeshComponent = player.getComponent("Mesh") as MeshComponent;
            playerMeshComponent.mesh.position = this._spawns[index].clone();
        });
    }
}