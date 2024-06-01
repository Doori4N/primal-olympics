import * as B from '@babylonjs/core';
import {Scene} from "../../core/Scene";
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
import {Commands, InputStates, InputType} from "../../core/types";
import {GamePresentation} from "../../core/components/GamePresentation";
import {Utils} from "../../utils/Utils";
import {CameraComponent} from "../../core/components/CameraComponent";
import {CameraAnimation} from "./components/CameraAnimation";
import {GameTimer} from "../../core/components/GameTimer";
import {CameraMovement} from "./components/CameraMovement";
import {NetworkTransformComponent} from "../../network/components/NetworkTransformComponent";
import {AIPlayerBehaviour} from "./components/players/AIPlayerBehaviour";
import {EdgeCollision} from "./components/EdgeCollision";
import {GameScores} from "./components/GameScores";
import {Leaderboard} from "../../core/components/Leaderboard";
import {PlayerData} from "../../network/types";
import {NetworkClient} from "../../network/NetworkClient";

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

    constructor() {
        super("Savage Soccer");
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
            this.game.networkInstance.addEventListener("onCreateGameManager", this._createGameManager.bind(this));
            this.game.networkInstance.addEventListener("onCreateBall", this._createBall.bind(this));
            this.game.networkInstance.addEventListener("onCreatePlayer", (args: {playerData: PlayerData, id: string, teamIndex: number}): void => {
                this._createPlayer(args.playerData, args.teamIndex, args.id);
            });
            this.game.networkInstance.addEventListener("onCreateAIPlayer", (args: {id: string, teamIndex: number}): void => {
                this._createAIPlayer(args.teamIndex, B.Vector2.Zero(), args.id);
            });
        }

        // load assets
        this.loadedAssets["caveman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "caveman.glb", this.babylonScene);
        this.loadedAssets["cavewoman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "cavewoman.glb", this.babylonScene);
        this.loadedAssets["footballPitch"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/scenes/", "footballPitch.glb", this.babylonScene);
        this.loadedAssets["ball"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "ball.glb", this.babylonScene);

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        this.enablePhysics(new B.Vector3(0, -9.81, 0));

        // camera
        this.mainCamera.position = new B.Vector3(0, 17, -15);
        this.mainCamera.setTarget(B.Vector3.Zero());

        // skybox
        const skybox: B.Mesh = B.MeshBuilder.CreateBox("skyBox", {size:1000.0}, this.babylonScene);
        const skyboxMaterial = new B.StandardMaterial("skyBox", this.babylonScene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new B.CubeTexture("img/skybox", this.babylonScene);
        skyboxMaterial.reflectionTexture.coordinatesMode = B.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new B.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new B.Color3(0, 0, 0);
        skybox.material = skyboxMaterial;

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

        // supporters
        this._createSupporters();

        this.eventManager.subscribe("onGoalScored", this._onGoalScored.bind(this));

        // CLIENT
        if (!this.game.networkInstance.isHost) {
            // tell the host that the player is ready
            const networkClient = this.game.networkInstance as NetworkClient;
            networkClient.sendToHost(`onPlayerReady${this.game.networkInstance.playerId}`);
        }
        // HOST
        else {
            this._createGameManager();
            this._createBall();
            this._initPlayers();
            this._initAIPlayers();
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
            new B.Vector3(0.46, 0, 16.50),
            new B.Vector3(15.81, 0, 14.12),
            new B.Vector3(13.21, 0, 18.06),
            new B.Vector3(9.37, 0, 18.73),
            new B.Vector3(-9.92, 0, 17.41),
            new B.Vector3(-6.21, 0, 18.05)
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

    private _createBall(entityId?: string): void {
        const ballEntity: Entity = this._createBallEntity(entityId);
        this.entityManager.addEntity(ballEntity);

        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onCreateBall", ballEntity.id);
        }
    }

    private _initPlayers(): void {
        const networkHost = this.game.networkInstance as NetworkHost;

        // shuffle teams index
        let teamIndexes: number[] = new Array(networkHost.players.length).fill(1, 0, networkHost.players.length / 2).fill(0, networkHost.players.length / 2);
        // Utils.shuffle(teamIndexes);

        for (let i: number = 0; i < networkHost.players.length; i++) {
            const playerData: PlayerData = networkHost.players[i];
            this._createPlayer(playerData, teamIndexes[i]);
        }
    }

    private _createPlayer(playerData: PlayerData, teamIndex: number, entityId?: string): void {
        const spawnIndex: number = this._teams[teamIndex].length;
        const spawnPosition: B.Vector3 = this._spawns[spawnIndex].clone();
        spawnPosition.x *= teamIndex === 0 ? -1 : 1;

        const playerEntity: Entity = this._createPlayerEntity(playerData, teamIndex, spawnPosition, entityId);
        this.entityManager.addEntity(playerEntity);

        // HOST
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onCreatePlayer", {
                playerData: playerData,
                teamIndex: teamIndex,
                id: playerEntity.id
            });
        }

        this._teams[teamIndex].push(playerEntity);
    }

    private _initAIPlayers(): void {
        // create blue team AI players
        for (let i: number = this._teams[0].length; i < 4; i++) {
            const wanderPosition: B.Vector2 = this._wanderPositions[i].clone();
            wanderPosition.x *= -1;
            this._createAIPlayer(0, wanderPosition)
        }

        // create orange team AI players
        for (let i: number = this._teams[1].length; i < 4; i++) {
            const wanderPosition: B.Vector2 = this._wanderPositions[i].clone();
            this._createAIPlayer(1, wanderPosition);
        }
    }

    private _createAIPlayer(teamIndex: number, wanderPosition: B.Vector2, entityId?: string): void {
        const spawnIndex: number = this._teams[teamIndex].length;
        const spawnPosition: B.Vector3 = this._spawns[spawnIndex].clone();
        spawnPosition.x *= teamIndex === 0 ? -1 : 1;

        const playerEntity: Entity = this._createAIPlayerEntity(teamIndex, spawnPosition, wanderPosition, entityId);
        this.entityManager.addEntity(playerEntity);

        this._teams[teamIndex].push(playerEntity);

        // HOST
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onCreateAIPlayer", {
                id: playerEntity.id,
                teamIndex: teamIndex
            });
        }
    }

    private _createGameManager(entityId?: string): void {
        const gameManagerEntity: Entity = this._createGameManagerEntity(entityId);
        this.entityManager.addEntity(gameManagerEntity);

        // HOST
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("onCreateGameManager", gameManagerEntity.id);
        }
    }

    private _createGameManagerEntity(entityId?: string): Entity {
        const gameManager = new Entity("gameManager", entityId);

        const description: string = `
            <span class='description-title'>The team with the most goals wins!</span></span><br>
            <ul>
                <li>Put the ball in the opponent's net to score</li>
                <li>Tackle opposing players to recover the ball</li>
                <li>Pass the ball to your teammates to outwit the opponent's defense</li>
            </ul>
        `;
        const imgSrc: string = "football-presentation.png";
        let commands: Commands[];
        if (this.game.inputManager.inputStates.type === InputType.GAMEPAD) {
            commands = [
                {keys: ["gamepad_leftStick"], description: "Move", style: "large-button-img"},
                {keys: ["gamepad_a"], description: "Shoot / Tackle", style: "large-button-img"},
                {keys: ["gamepad_b"], description: "Pass", style: "large-button-img"},
            ];
        }
        else {
            commands = [
                {keys: ["keyboard_z", "keyboard_q", "keyboard_s", "keyboard_d"], description: "Move", style: "key-img"},
                {keys: ["keyboard_space"], description: "Shoot / Tackle", style: "large-key-img"},
                {keys: ["keyboard_shift"], description: "Pass", style: "large-key-img"},
            ]
        }
        gameManager.addComponent(new GamePresentation(gameManager, this, {description, imgSrc, commands}));

        gameManager.addComponent(new GameMessages(gameManager, this));
        gameManager.addComponent(new GameTimer(gameManager, this, {duration: 120}));
        gameManager.addComponent(new GameController(gameManager, this));
        gameManager.addComponent(new GameScores(gameManager, this));
        gameManager.addComponent(new Leaderboard(gameManager, this));

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

    private _createPlayerEntity(playerData: PlayerData, teamIndex: number, position: B.Vector3, entityId?: string): Entity {
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

        // player skin colors
        Utils.applyColorsToMesh(player, playerData.skinOptions);

        // change the outfit color based on the team
        const outifIndex: number = (playerData.skinOptions.modelIndex === 0) ? 1 : 2;
        const outfitMaterial = player.getChildMeshes()[outifIndex].material as B.PBRMaterial;
        outfitMaterial.albedoColor = this._teamColors[teamIndex].albedoColor;
        outfitMaterial.emissiveColor = this._teamColors[teamIndex].emissiveColor;

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
        animations["Kicking"] = Utils.getAnimationGroupByName(`Soccer_Pass${playerEntity.id}`, entries.animationGroups);
        animations["Tackling"] = Utils.getAnimationGroupByName(`Soccer_Tackle${playerEntity.id}`, entries.animationGroups);
        animations["Tackle_Reaction"] = Utils.getAnimationGroupByName(`Soccer_Tackle_React${playerEntity.id}`, entries.animationGroups);
        animations["Celebration"] = Utils.getAnimationGroupByName(`Victory${playerEntity.id}`, entries.animationGroups);
        animations["Defeat"] = Utils.getAnimationGroupByName(`Defeat${playerEntity.id}`, entries.animationGroups);
        animations["TakeTheL"] = Utils.getAnimationGroupByName(`Loser${playerEntity.id}`, entries.animationGroups);
        playerEntity.addComponent(new NetworkAnimationComponent(playerEntity, this, {animations: animations}));

        playerEntity.addComponent(new NetworkPredictionComponent<InputStates>(playerEntity, this, {usePhysics: true}));
        playerEntity.addComponent(new PlayerBehaviour(playerEntity, this, {playerData: playerData, teamIndex: teamIndex}));

        return playerEntity;
    }

    private _createAIPlayerEntity(teamIndex: number, position: B.Vector3, wanderPosition: B.Vector2, entityId?: string): Entity {
        const randomModelIndex: number = Utils.randomInt(0, 1);
        let playerContainer: B.AssetContainer;
        if (randomModelIndex === 0) {
            playerContainer = this.loadedAssets["caveman"];
        }
        else {
            playerContainer = this.loadedAssets["cavewoman"];
        }
        const aiPlayerEntity = new Entity("aiPlayer", entityId);

        const entries: B.InstantiatedEntries = playerContainer.instantiateModelsToScene((sourceName: string): string => sourceName + aiPlayerEntity.id, true, {doNotInstantiate: true});
        const aiPlayer = entries.rootNodes[0] as B.Mesh;

        const outifIndex: number = (randomModelIndex === 0) ? 1 : 2;
        const outfitMaterial = aiPlayer.getChildMeshes()[outifIndex].material as B.PBRMaterial;
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
        animations["Idle"] = Utils.getAnimationGroupByName(`Idle${aiPlayerEntity.id}`, entries.animationGroups);
        animations["Running"] = Utils.getAnimationGroupByName(`Running${aiPlayerEntity.id}`, entries.animationGroups);
        animations["Kicking"] = Utils.getAnimationGroupByName(`Soccer_Pass${aiPlayerEntity.id}`, entries.animationGroups);
        animations["Tackling"] = Utils.getAnimationGroupByName(`Soccer_Tackle${aiPlayerEntity.id}`, entries.animationGroups);
        animations["Tackle_Reaction"] = Utils.getAnimationGroupByName(`Soccer_Tackle_React${aiPlayerEntity.id}`, entries.animationGroups);
        aiPlayerEntity.addComponent(new NetworkAnimationComponent(aiPlayerEntity, this, {animations: animations}));

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

    private _createBallEntity(entityId?: string): Entity {
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
}