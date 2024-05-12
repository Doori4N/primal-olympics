import * as B from '@babylonjs/core';
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import {Game} from "./Game";
import {EventManager} from "./EventManager";
import {EntityManager} from "./EntityManager";
import {SceneManager} from "./SceneManager";
import {IPhysicsEngine} from "@babylonjs/core/Physics/IPhysicsEngine";

export abstract class Scene {
    public babylonScene: B.Scene;
    public mainCamera: B.FreeCamera;
    public game: Game = Game.getInstance();
    public eventManager = new EventManager();
    public entityManager = new EntityManager();
    public sceneManager: SceneManager = SceneManager.getInstance();
    public loadedAssets: { [name: string]: B.AssetContainer } = {};
    public physicsPlugin: B.Nullable<B.HavokPlugin> = null;

    protected constructor() {
        // initialize the scene with a main camera
        this.babylonScene = new B.Scene(this.game.engine);
        this.mainCamera = new B.FreeCamera("mainCamera", new B.Vector3(0, 5, -10), this.babylonScene);
    }

    public async preload(): Promise<void> {};

    /**
     * Initialize all entities
     */
    public abstract start(): void;

    /**
     * Render the scene and update entities
     */
    public update(): void {
        this.babylonScene.render();
        this.entityManager.update();
    }

    public fixedUpdate(): void {
        this.entityManager.fixedUpdate();
        this._executeStep(1 / 60);
    }

    /**
     * Destroy the scene and all entities
     */
    public destroy(): void {
        // TODO: destroy loadedAssets
        this.mainCamera.dispose();
        this.babylonScene.dispose();
        this.entityManager.removeAllEntities();
    }

    public enablePhysics(gravityVector?: B.Vector3): void {
        this.physicsPlugin = new B.HavokPlugin(false, this.game.havokInstance);
        this.babylonScene.enablePhysics(gravityVector, this.physicsPlugin);
        // set physics to disabled to update it manually in fixedUpdate
        this.babylonScene.physicsEnabled = false;
    }

    /**
     * Execute one physics step and notify observers
     * @param delta - defines the timespan between frames
     */
    protected _executeStep(delta: number): void {
        const physicsEngine: B.Nullable<IPhysicsEngine> = this.babylonScene.getPhysicsEngine();
        if (!physicsEngine) return;

        this.babylonScene.onBeforePhysicsObservable.notifyObservers(this.babylonScene);
        physicsEngine._step(delta);
        this.babylonScene.onAfterPhysicsObservable.notifyObservers(this.babylonScene);
    }

    public simulate(physicsBodies: B.PhysicsBody[]): void {
        this.physicsPlugin!.executeStep(1 / 60, physicsBodies);
    }
}