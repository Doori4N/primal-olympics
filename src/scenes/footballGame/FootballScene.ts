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

export class FootballScene extends Scene {
    private _ballMesh!: B.Mesh;

    constructor() {
        super("football");
    }

    public async loadAssets(): Promise<void> {
        this.game.engine.displayLoadingUI();

        // load assets
        this.loadedAssets["player"] = await B.SceneLoader.LoadAssetContainerAsync(
            "https://assets.babylonjs.com/meshes/",
            "HVGirl.glb",
            this.babylonScene
        );

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        this.enablePhysics(new B.Vector3(0, -9.81, 0));

        // camera
        this.mainCamera.position = new B.Vector3(0, 20, -20);
        this.mainCamera.setTarget(B.Vector3.Zero());
        this.mainCamera.attachControl(this.game.canvas, true);

        // light
        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.babylonScene);
        light.intensity = 0.7;

        // ground
        const groundEntity = new Entity("ground");
        const ground: B.GroundMesh = B.MeshBuilder.CreateGround("ground", {width: 35, height: 20}, this.babylonScene);
        ground.metadata = {tag: groundEntity.tag};
        groundEntity.addComponent(new MeshComponent(groundEntity, this, {mesh: ground}));
        groundEntity.addComponent(new RigidBodyComponent(groundEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(groundEntity);

        // ball
        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            const ballEntity: Entity = this._createBall();
            this.entityManager.addEntity(ballEntity);
            networkHost.sendToAllClients("onCreateBall", {id: ballEntity.id});
        }
        else {
            this.game.networkInstance.addEventListener("onCreateBall", (args: {id: string}): void => {
                const ballEntity: Entity = this._createBall(args.id);
                this.entityManager.addEntity(ballEntity);
            });
        }

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
        }

        // Goals
        this._createGoal("leftGoal", new B.Vector3(-17, 1.5, 0));
        this._createGoal("rightGoal", new B.Vector3(17, 1.5, 0));

        // gameManager
        const gameManager = new Entity("gameManager");
        gameManager.addComponent(new GameMessages(gameManager, this));
        gameManager.addComponent(new GameController(gameManager, this));
        this.entityManager.addEntity(gameManager);

        this.eventManager.subscribe("onGoalScored", this._onGoalScored.bind(this));
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

    private _createPlayer(playerContainer: B.AssetContainer, playerId: string, entityId?: string): Entity {
        const playerEntity = new Entity("player", entityId);

        const entries: B.InstantiatedEntries = playerContainer.instantiateModelsToScene((sourceName: string): string => sourceName + playerEntity.id, false, {doNotInstantiate: true});
        const player = entries.rootNodes[0] as B.Mesh;

        player.scaling.scaleInPlace(0.1);

        const hitbox = new B.Mesh(`hitbox${playerEntity.id}`, this.babylonScene);
        hitbox.metadata = {tag: playerEntity.tag, id: playerEntity.id};
        player.setParent(hitbox);
        player.position = new B.Vector3(0, -1, 0);
        hitbox.position = new B.Vector3(2, 1, 0);

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
        animations["Walking"] = entries.animationGroups[2];
        playerEntity.addComponent(new NetworkAnimationComponent(playerEntity, this, {animations: animations}));

        playerEntity.addComponent(new NetworkPredictionComponent<InputStates>(playerEntity, this, {usePhysics: true}));
        playerEntity.addComponent(new PlayerBehaviour(playerEntity, this, {playerId: playerId}));

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

        // ballEntity.addComponent(new NetworkTransformComponent(ballEntity, this, {usePhysics: true}));
        ballEntity.addComponent(new NetworkPredictionComponent<B.Vector3>(ballEntity, this, {usePhysics: true}));
        ballEntity.addComponent(new BallBehaviour(ballEntity, this));

        return ballEntity;
    }

    private _onGoalScored(): void {
        this._ballMesh.position = new B.Vector3(0, 0.5, 0);
    }
}