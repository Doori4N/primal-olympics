import {Scene} from "../../core/Scene";
import * as B from '@babylonjs/core';
import {Entity} from "../../core/Entity";
import {GamePresentation} from "../../components/GamePresentation";
import {GameMessages} from "../../components/GameMessages";
import {Leaderboard} from "../../components/Leaderboard";
import {MeshComponent} from "../../components/MeshComponent";
import {RigidBodyComponent} from "../../components/RigidBodyComponent";
import {PlayerBehaviour} from "./PlayerBehaviour";
import {MeteoriteController} from "./MeteoriteController";
import {GameTimer} from "./GameTimer";

export class MeteoritesScene extends Scene {
    constructor() {
        super("meteorites");
    }

    public start(): void {
        // hide/show the Inspector
        window.addEventListener("keydown", (e: KeyboardEvent): void => {
            // Shift+Ctrl+I
            if (e.shiftKey && e.ctrlKey && e.code === "KeyI") {
                if (this.scene.debugLayer.isVisible()) {
                    this.scene.debugLayer.hide();
                } else {
                    this.scene.debugLayer.show({overlay: true, handleResize: true});
                }
            }
        });

        // Enable physics engine
        const gravityVector = new B.Vector3(0, -9.81, 0);
        this.scene.enablePhysics(gravityVector, this.game.physicsPlugin);

        // Use right-handed system to match the gltf model (otherwise the model will be flipped)
        this.scene.useRightHandedSystem = true;

        // camera
        this.mainCamera.position = new B.Vector3(0, 30, -20);
        this.mainCamera.setTarget(B.Vector3.Zero());
        this.mainCamera.attachControl(this.game.canvas, true);
        this.mainCamera.speed = 0.3;

        // light
        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;

        // ground
        const groundEntity = new Entity("ground");
        const ground: B.GroundMesh = B.MeshBuilder.CreateGround("ground", {width: 6, height: 6}, this.scene);
        ground.metadata = {tag: groundEntity.tag};
        ground.position.y = 0;
        ground.scaling.x = 3;
        ground.scaling.z = 3;
        groundEntity.addComponent(new MeshComponent(groundEntity, this, {mesh: ground}));
        groundEntity.addComponent(new RigidBodyComponent(groundEntity, this, {
            physicsShape: B.PhysicsShapeType.BOX,
            physicsProps: {mass: 0}
        }));
        this.entityManager.addEntity(groundEntity);

        // players
        B.SceneLoader.LoadAssetContainer(
            "https://assets.babylonjs.com/meshes/",
            "HVGirl.glb",
            this.scene,
            (container: B.AssetContainer): void => {
                for (let i: number = 0; i < this.game.playerData.length; i++) {
                    const entries: B.InstantiatedEntries = container.instantiateModelsToScene((sourceName: string): string => sourceName + i, false, {doNotInstantiate: true});
                    const player: B.Mesh = this.scene.getMeshByName("__root__" + i) as B.Mesh;
                    if (!player) throw new Error("Player mesh not found");

                    player.scaling.scaleInPlace(0.1);
                    const playerEntity = new Entity("player");

                    const hitbox = new B.Mesh(`hitbox${i}`, this.scene);
                    hitbox.metadata = {tag: playerEntity.tag, id: playerEntity.id};

                    player.setParent(hitbox);
                    player.position = new B.Vector3(0.5, 0, 0.5);

                    playerEntity.addComponent(new MeshComponent(playerEntity, this, {mesh: hitbox}));
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
                    playerEntity.addComponent(new PlayerBehaviour(playerEntity, this, {inputIndex: i, animationGroups: entries.animationGroups}));
                    this.entityManager.addEntity(playerEntity);
                }
            });

        // meteorites
        const meteoriteController = new Entity();
        meteoriteController.addComponent(new MeteoriteController(meteoriteController, this));
        this.entityManager.addEntity(meteoriteController);

        // gameController
        const gameController = new Entity();
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
        this.entityManager.addEntity(gameController);
    }
}