import {Scene} from "../../core/Scene";
import * as B from '@babylonjs/core';
import {Entity} from "../../core/Entity";
import {MeshComponent} from "../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../core/components/RigidBodyComponent";
import {NetworkAnimationComponent} from "../../network/components/NetworkAnimationComponent";
import {PlayerBehaviour} from "./components/players/PlayerBehaviour";
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
import {NetworkTransformComponent} from "../../network/components/NetworkTransformComponent";
import {AIPlayerBehaviour} from "./components/players/AIPlayerBehaviour";
import {NetworkAudioComponent} from "../../network/components/NetworkAudioComponent";
import {EdgeCollision} from "./components/EdgeCollision";
import {GameScores} from "./components/GameScores";
import {Leaderboard} from "../../core/components/Leaderboard";

const PITCH_WIDTH: number = 40;
const PITCH_HEIGHT: number = 27;

export class FootballScene extends Scene {
    private _ballMesh!: B.Mesh;
    private _spawns: B.Vector3[] = [
        new B.Vector3(5, 1, 5),
        new B.Vector3(5, 1, -5),
        new B.Vector3(10, 1, 5),
        new B.Vector3(10, 1, -5)
    ];
    private _wanderPositions: B.Vector2[] = [
        new B.Vector2(-8.5, 4.5),
        new B.Vector2(-8.5, -4.5),
        new B.Vector2(12, 4.5),
        new B.Vector2(12, -4.5)
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

    constructor() {
        super("football");
    }

    public async loadAssets(): Promise<void> {
        this.game.engine.displayLoadingUI();

        // load assets
        this.loadedAssets["player"] = await B.SceneLoader.LoadAssetContainerAsync(
            "meshes/models/",
            "caveman.glb",
            this.babylonScene
        );

        this.loadedAssets["footballPitch"] = await B.SceneLoader.LoadAssetContainerAsync(
            "meshes/scenes/",
            "footballPitch.glb",
            this.babylonScene
        );

        this.loadedAssets["ball"] = await B.SceneLoader.LoadAssetContainerAsync(
            "meshes/models/",
            "ball.glb",
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

        this._createFootballPitch();
        this._initBall();

        // players
        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.babylonScene);
        this._initPlayers();

        // AI players
        this._initAIPlayers();

        // goals
        this._createGoal("leftGoal", new B.Vector3(-PITCH_WIDTH / 2 - 1.25, 1.5, 0));
        this._createGoal("rightGoal", new B.Vector3(PITCH_WIDTH / 2 + 1.25, 1.5, 0));

        // edges
        this._createEdge(new B.Vector3(0, 1.5, (PITCH_HEIGHT / 2) + 0.5), new B.Vector3(0, Math.PI, 0), PITCH_WIDTH);
        this._createEdge(new B.Vector3(0, 1.5, (-PITCH_HEIGHT / 2) - 0.5), new B.Vector3(0, 0, 0), PITCH_WIDTH);
        this._createEdge(new B.Vector3((PITCH_WIDTH / 2) + 0.5, 1.5, -8.5), new B.Vector3(0, -Math.PI / 2, 0), (PITCH_HEIGHT / 2) - 3);
        this._createEdge(new B.Vector3((PITCH_WIDTH / 2) + 0.5, 1.5, 8.5), new B.Vector3(0, -Math.PI / 2, 0), (PITCH_HEIGHT / 2) - 3);
        this._createEdge(new B.Vector3((-PITCH_WIDTH / 2) - 0.5, 1.5, -8.5), new B.Vector3(0, Math.PI / 2, 0), (PITCH_HEIGHT / 2) - 3);
        this._createEdge(new B.Vector3((-PITCH_WIDTH / 2) - 0.5, 1.5, 8.5), new B.Vector3(0, Math.PI / 2, 0), (PITCH_HEIGHT / 2) - 3);

        // gameManager
        this._initGameManager();

        this.eventManager.subscribe("onGoalScored", this._onGoalScored.bind(this));
        this.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
    }

    private _createFootballPitch(): void {
        const groundEntity = new Entity("ground");

        const mapContainer: B.AssetContainer = this.loadedAssets["footballPitch"];
        mapContainer.addAllToScene();
        const footballPitch: B.Mesh = mapContainer.meshes[0] as B.Mesh;
        mapContainer.meshes.forEach((mesh: B.AbstractMesh): void => {
            mesh.receiveShadows = true;
        });
        footballPitch.scaling.scaleInPlace(4);

        const ground: B.GroundMesh = B.MeshBuilder.CreateGround("ground", {width: PITCH_WIDTH + 5, height: PITCH_HEIGHT}, this.babylonScene);
        ground.metadata = {tag: groundEntity.tag};
        ground.isVisible = false;
        footballPitch.setParent(ground);
        footballPitch.rotationQuaternion = B.Quaternion.RotationAxis(new B.Vector3(1, 0, 0), Math.PI);
        footballPitch.position = new B.Vector3(0.928, 0.239, 0.082);

        groundEntity.addComponent(new MeshComponent(groundEntity, this, {mesh: ground}));
        groundEntity.addComponent(new RigidBodyComponent(groundEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(groundEntity);
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
        // HOST
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;

            // shuffle teams index
            let teamIndexes: number[] = new Array(networkHost.players.length).fill(0, 0, networkHost.players.length / 2).fill(1, networkHost.players.length / 2);
            Utils.shuffle(teamIndexes);

            for (let i: number = 0; i < networkHost.players.length; i++) {
                const playerId: string = networkHost.players[i].id;

                const spawnIndex: number = this._teams[teamIndexes[i]].length;
                const spawnPosition: B.Vector3 = this._spawns[spawnIndex].clone();
                spawnPosition.x *= teamIndexes[i] === 0 ? -1 : 1;

                const playerEntity: Entity = this._createPlayer(playerId, teamIndexes[i], spawnPosition);
                this.entityManager.addEntity(playerEntity);

                networkHost.sendToAllClients("onCreatePlayer", {
                    playerId: playerId,
                    id: playerEntity.id,
                    teamIndex: teamIndexes[i]
                });

                this._teams[teamIndexes[i]].push(playerEntity);
            }
        }
        // CLIENT
        else {
            this.game.networkInstance.addEventListener("onCreatePlayer", (args: {playerId: string, id: string, teamIndex: number}): void => {
                const spawnIndex: number = this._teams[args.teamIndex].length;
                const spawnPosition: B.Vector3 = this._spawns[spawnIndex].clone();
                spawnPosition.x *= args.teamIndex === 0 ? -1 : 1;

                const playerEntity: Entity = this._createPlayer(args.playerId, args.teamIndex, spawnPosition, args.id);
                this.entityManager.addEntity(playerEntity);

                this._teams[args.teamIndex].push(playerEntity);
            });
        }
    }

    private _initAIPlayers(): void {
        // HOST
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;

            // create blue team AI players
            for (let i: number = this._teams[0].length; i < 4; i++) {
                const spawnPosition: B.Vector3 = this._spawns[i].clone();
                spawnPosition.x *= -1;
                const wanderPosition: B.Vector2 = this._wanderPositions[i].clone();
                wanderPosition.x *= -1;

                const playerEntity: Entity = this._createAIPlayer(0, spawnPosition, wanderPosition);
                this.entityManager.addEntity(playerEntity);

                networkHost.sendToAllClients("onCreateAIPlayer", {
                    id: playerEntity.id,
                    teamIndex: 0
                });

                this._teams[0].push(playerEntity);
            }

            // create orange team AI players
            for (let i: number = this._teams[1].length; i < 4; i++) {
                const spawnPosition: B.Vector3 = this._spawns[i].clone();
                const wanderPosition: B.Vector2 = this._wanderPositions[i].clone();

                const playerEntity: Entity = this._createAIPlayer(1, spawnPosition, wanderPosition);
                this.entityManager.addEntity(playerEntity);

                networkHost.sendToAllClients("onCreateAIPlayer", {
                    id: playerEntity.id,
                    teamIndex: 1
                });

                this._teams[1].push(playerEntity);
            }
        }
        // CLIENT
        else {
            this.game.networkInstance.addEventListener("onCreateAIPlayer", (args: {id: string, teamIndex: number}): void => {
                const spawnIndex: number = this._teams[args.teamIndex].length;
                const spawnPosition: B.Vector3 = this._spawns[spawnIndex].clone();
                spawnPosition.x *= args.teamIndex === 0 ? -1 : 1;

                const playerEntity: Entity = this._createAIPlayer(args.teamIndex, spawnPosition, B.Vector2.Zero(), args.id);
                this.entityManager.addEntity(playerEntity);

                this._teams[args.teamIndex].push(playerEntity);
            });
        }
    }

    private _initGameManager(): void {
        // HOST
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            const gameManagerEntity = this._createGameManager();
            networkHost.sendToAllClients("onCreateGameManager", gameManagerEntity.id);
        }
        // CLIENT
        else {
            this.game.networkInstance.addEventListener("onCreateGameManager", (id: string): void => {
                this._createGameManager(id);
            });
        }
    }

    private _createGameManager(entityId?: string): Entity {
        const gameManager = new Entity("gameManager", entityId);
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
        gameManager.addComponent(new GameScores(gameManager, this));
        gameManager.addComponent(new Leaderboard(gameManager, this));

        // audio
        const sounds: {[key: string]: B.Sound} = {};
        sounds["Crowd"] = new B.Sound("crowd_reaction", "sounds/crowd_reaction.wav", this.babylonScene, null, {loop: false, autoplay: false});
        sounds["Whistle"] = new B.Sound("whistle", "sounds/whistle.wav", this.babylonScene, null, {loop: false, autoplay: false});
        sounds["CrowdAmbience"] = new B.Sound("crowd_ambience", "sounds/crowd_ambience.wav", this.babylonScene, null, {loop: true, autoplay: true, volume: 0});
        gameManager.addComponent(new NetworkAudioComponent(gameManager, this, {sounds}));
        this.entityManager.addEntity(gameManager);

        return gameManager;
    }

    private _createEdge(edgePosition: B.Vector3, edgeRotation: B.Vector3, length: number): void {
        const edgeEntity = new Entity("edge");
        const edgeMesh: B.Mesh = B.MeshBuilder.CreateBox("edge", {width: length, height: 3, depth: 1}, this.babylonScene);
        edgeMesh.isVisible = false;
        edgeMesh.position = edgePosition;
        edgeMesh.rotation = edgeRotation;
        edgeEntity.addComponent(new MeshComponent(edgeEntity, this, {mesh: edgeMesh}));
        edgeEntity.addComponent(new RigidBodyComponent(edgeEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0},
            isCollisionCallbackEnabled: true
        }));
        edgeEntity.addComponent(new EdgeCollision(edgeEntity, this));
        this.entityManager.addEntity(edgeEntity);
    }

    private _createGoal(goalName: string, goalPosition: B.Vector3): void {
        const goalEntity = new Entity(`${goalName}`);
        const goalMesh: B.Mesh = B.MeshBuilder.CreateBox(`${goalName}`, {width: 1, height: 3, depth: 6}, this.babylonScene);
        goalMesh.position = goalPosition;
        goalMesh.metadata = {tag: goalEntity.tag};
        goalMesh.isVisible = false;
        goalEntity.addComponent(new MeshComponent(goalEntity, this, {mesh: goalMesh}));
        goalEntity.addComponent(new RigidBodyComponent(goalEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0},
            isTrigger: true
        }));
    }

    private _createPlayer(playerId: string, teamIndex: number, position: B.Vector3, entityId?: string): Entity {
        const playerContainer: B.AssetContainer = this.loadedAssets["player"];
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

        const shadow = B.MeshBuilder.CreateDisc("shadow", {radius: 0.5}, this.babylonScene);
        const shadowMaterial = new B.StandardMaterial("shadowMaterial", this.babylonScene);
        shadowMaterial.diffuseColor = new B.Color3(0, 0, 0);
        shadow.material = shadowMaterial;
        shadow.material.alpha = 0.5;
        shadow.setParent(hitbox);
        shadow.rotate(B.Axis.X, Math.PI / 2, B.Space.WORLD);
        shadow.position.y = -0.98;

        hitbox.position = position;
        const rotationOrientation: number = teamIndex === 0 ? 1 : -1;
        hitbox.rotate(B.Axis.Y, rotationOrientation * (Math.PI / 2), B.Space.WORLD);

        // player name text
        const playerNameText = new GUI.TextBlock();
        playerNameText.text = this.game.networkInstance.players.find((playerData) => playerData.id === playerId)!.name;
        playerNameText.color = (teamIndex === 0) ? "#0000ff" : "#ff0000"
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
        animations["Kicking"] = this._getAnimationGroupByName(`Soccer_Pass${playerEntity.id}`, entries.animationGroups);
        animations["Tackling"] = this._getAnimationGroupByName(`Soccer_Tackle${playerEntity.id}`, entries.animationGroups);
        animations["Tackle_Reaction"] = this._getAnimationGroupByName(`Soccer_Tackle_React${playerEntity.id}`, entries.animationGroups);
        animations["Celebration"] = this._getAnimationGroupByName(`Victory${playerEntity.id}`, entries.animationGroups);
        animations["Defeat"] = this._getAnimationGroupByName(`Defeat${playerEntity.id}`, entries.animationGroups);
        animations["TakeTheL"] = this._getAnimationGroupByName(`Loser${playerEntity.id}`, entries.animationGroups);
        playerEntity.addComponent(new NetworkAnimationComponent(playerEntity, this, {animations: animations}));

        // audio
        const sounds: {[key: string]: B.Sound} = {};
        sounds["Kick"] = new B.Sound("soccer_ball_kick", "sounds/soccer_ball_kick.wav", this.babylonScene, null, {loop: false, autoplay: false});
        playerEntity.addComponent(new NetworkAudioComponent(playerEntity, this, {sounds}));

        playerEntity.addComponent(new NetworkPredictionComponent<InputStates>(playerEntity, this, {usePhysics: true}));
        playerEntity.addComponent(new PlayerBehaviour(playerEntity, this, {playerId: playerId, teamIndex: teamIndex}));

        return playerEntity;
    }

    private _createAIPlayer(teamIndex: number, position: B.Vector3, wanderPosition: B.Vector2, entityId?: string): Entity {
        const playerContainer: B.AssetContainer = this.loadedAssets["player"];
        const aiPlayerEntity = new Entity("aiPlayer", entityId);

        const entries: B.InstantiatedEntries = playerContainer.instantiateModelsToScene((sourceName: string): string => sourceName + aiPlayerEntity.id, true, {doNotInstantiate: true});
        const aiPlayer = entries.rootNodes[0] as B.Mesh;

        const outfitMaterial = aiPlayer.getChildMeshes()[1].material as B.PBRMaterial;
        outfitMaterial.albedoColor = this._teamColors[teamIndex].albedoColor;
        outfitMaterial.emissiveColor = this._teamColors[teamIndex].emissiveColor;

        aiPlayer.scaling.scaleInPlace(0.25);

        const hitbox = new B.Mesh(`hitbox${aiPlayerEntity.id}`, this.babylonScene);
        hitbox.metadata = {tag: aiPlayerEntity.tag, id: aiPlayerEntity.id};
        aiPlayer.setParent(hitbox);
        aiPlayer.position = new B.Vector3(0, -1, 0);

        const shadow = B.MeshBuilder.CreateDisc("shadow", {radius: 0.5}, this.babylonScene);
        const shadowMaterial = new B.StandardMaterial("shadowMaterial", this.babylonScene);
        shadowMaterial.diffuseColor = new B.Color3(0, 0, 0);
        shadow.material = shadowMaterial;
        shadow.material.alpha = 0.5;
        shadow.setParent(hitbox);
        shadow.rotate(B.Axis.X, Math.PI / 2, B.Space.WORLD);
        shadow.position.y = -0.98;

        hitbox.position = position;
        const rotationOrientation: number = teamIndex === 0 ? 1 : -1;
        hitbox.rotate(B.Axis.Y, rotationOrientation * (Math.PI / 2), B.Space.WORLD);

        aiPlayerEntity.addComponent(new MeshComponent(aiPlayerEntity, this, {mesh: hitbox}));

        const playerPhysicsShape = new B.PhysicsShapeBox(
            new B.Vector3(0, 0, 0),
            new B.Quaternion(0, 0, 0, 1),
            new B.Vector3(1, 2, 1),
            this.babylonScene
        );
        aiPlayerEntity.addComponent(new RigidBodyComponent(aiPlayerEntity, this, {
            physicsShape: playerPhysicsShape,
            physicsProps: {mass: 1},
            massProps: {inertia: new B.Vector3(0, 0, 0)},
            isCollisionCallbackEnabled: true
        }));

        const animations: {[key: string]: B.AnimationGroup} = {};
        animations["Idle"] = this._getAnimationGroupByName(`Idle${aiPlayerEntity.id}`, entries.animationGroups);
        animations["Running"] = this._getAnimationGroupByName(`Running${aiPlayerEntity.id}`, entries.animationGroups);
        animations["Kicking"] = this._getAnimationGroupByName(`Soccer_Pass${aiPlayerEntity.id}`, entries.animationGroups);
        animations["Tackling"] = this._getAnimationGroupByName(`Soccer_Tackle${aiPlayerEntity.id}`, entries.animationGroups);
        animations["Tackle_Reaction"] = this._getAnimationGroupByName(`Soccer_Tackle_React${aiPlayerEntity.id}`, entries.animationGroups);
        aiPlayerEntity.addComponent(new NetworkAnimationComponent(aiPlayerEntity, this, {animations: animations}));

        // audio
        const sounds: {[key: string]: B.Sound} = {};
        sounds["Kick"] = new B.Sound("soccer_ball_kick", "sounds/soccer_ball_kick.wav", this.babylonScene, null, {loop: false, autoplay: false});
        aiPlayerEntity.addComponent(new NetworkAudioComponent(aiPlayerEntity, this, {sounds}));

        aiPlayerEntity.addComponent(new NetworkTransformComponent(aiPlayerEntity, this, {usePhysics: true}));
        aiPlayerEntity.addComponent(new AIPlayerBehaviour(aiPlayerEntity, this, {
            teamIndex: teamIndex,
            wanderArea: {
                position: wanderPosition,
                size: 8
            }
        }));

        return aiPlayerEntity;
    }

    private _createBall(entityId?: string): Entity {
        const ballContainer: B.AssetContainer = this.loadedAssets["ball"];
        const ballEntity = new Entity("ball", entityId);

        ballContainer.addAllToScene();
        ballContainer.meshes[1].position = B.Vector3.Zero();
        this._ballMesh = ballContainer.meshes[0] as B.Mesh;
        this._ballMesh.position = new B.Vector3(0, 0.35, 0);
        this._ballMesh.scaling.scaleInPlace(0.35);
        this._ballMesh.metadata = {tag: ballEntity.tag, id: ballEntity.id};

        ballEntity.addComponent(new MeshComponent(ballEntity, this, {mesh: this._ballMesh}));

        const ballPhysicsShape = new B.PhysicsShapeSphere(
            new B.Vector3(0, 0, 0),
            0.35,
            this.babylonScene
        );
        ballEntity.addComponent(new RigidBodyComponent(ballEntity, this, {
            physicsShape: ballPhysicsShape,
            physicsProps: {mass: 1},
            massProps: {inertia: new B.Vector3(0, 0, 0)}
        }));

        ballEntity.addComponent(new NetworkPredictionComponent<B.Vector3>(ballEntity, this, {usePhysics: true}));
        ballEntity.addComponent(new BallBehaviour(ballEntity, this));

        return ballEntity;
    }

    private _onGoalScored(): void {
        setTimeout((): void => {
            this.game.fadeIn(this._resetObjectsPosition.bind(this));
        }, 1000);

        setTimeout((): void => {
            this.eventManager.notify("onGoalReset");
        }, 4000);
    }

    private _onGameFinished(): void {
        this._gui.dispose();
    }

    private _resetObjectsPosition(): void {
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

    private _getAnimationGroupByName(name: string, animationGroups: B.AnimationGroup[]): B.AnimationGroup {
        return animationGroups.find((animationGroup: B.AnimationGroup): boolean => animationGroup.name === name)!;
    }
}