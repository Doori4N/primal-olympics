import * as B from '@babylonjs/core';
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import {Game} from "./Game";
import {EventManager} from "./EventManager";
import {EntityManager} from "./EntityManager";
import {SceneManager} from "./SceneManager";
import {IPhysicsEngine} from "@babylonjs/core/Physics/IPhysicsEngine";

export class Scene {
    public name: string;
    public scene: B.Scene;
    public mainCamera: B.FreeCamera;
    public game: Game = Game.getInstance();
    public eventManager = new EventManager();
    public entityManager = new EntityManager();
    public sceneManager: SceneManager = SceneManager.getInstance();
    public loadedAssets: { [name: string]: B.AssetContainer } = {};

    constructor(name: string) {
        this.name = name;

        // initialize the scene with a main camera
        this.scene = new B.Scene(this.game.engine);
        this.mainCamera = new B.FreeCamera("mainCamera", new B.Vector3(0, 5, -10), this.scene);
    }

    public async loadAssets(): Promise<void> {};

    /**
     * Function to override
     * Initialize all entities
     */
    public start(): void {}

    /**
     * Render the scene and update entities
     */
    public update(): void {
        this.scene.render();
        this.entityManager.update();
    }

    public fixedUpdate(): void {
        this.entityManager.fixedUpdate();
        if (this.game.networkInstance?.isConnected) this.game.networkInstance.fixedUpdate();
        this._executeStep(1 / 60);
    }

    /**
     * Destroy the scene and all entities
     */
    public destroy(): void {
        // TODO: destroy loadedAssets
        this.mainCamera.dispose();
        this.scene.dispose();
        this.entityManager.destroyAllEntities();
    }

    public enablePhysics(gravityVector?: B.Vector3): void {
        this.scene.enablePhysics(gravityVector, this.game.physicsPlugin);
        // set physics to disabled to update it manually in fixedUpdate
        this.scene.physicsEnabled = false;
    }

    /**
     * Execute one physics step and notify observers
     * @param delta - defines the timespan between frames
     */
    private _executeStep(delta: number): void {
        const physicsEngine: B.Nullable<IPhysicsEngine> = this.scene.getPhysicsEngine();
        if (!physicsEngine) return;

        this.scene.onBeforePhysicsObservable.notifyObservers(this.scene);
        physicsEngine._step(delta);
        this.scene.onAfterPhysicsObservable.notifyObservers(this.scene);
    }
}