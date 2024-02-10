import * as B from '@babylonjs/core';
import {Inspector} from "@babylonjs/inspector";
import {Game} from "./Game";
import {EventManager} from "./EventManager";
import {EntityManager} from "./EntityManager";
import {SceneManager} from "./SceneManager";

export class Scene {
    public name: string;
    public scene: B.Scene;
    public mainCamera: B.FreeCamera;
    public game: Game;
    public eventManager: EventManager;
    public entityManager: EntityManager;
    public sceneManager: SceneManager;

    constructor(name: string) {
        this.name = name;
        this.game = Game.getInstance();
        this.sceneManager = SceneManager.getInstance();
        this.eventManager = new EventManager();
        this.entityManager = new EntityManager();

        // initialize the scene with a main camera
        this.scene = new B.Scene(this.game.engine);
        this.mainCamera = new B.FreeCamera("mainCamera", new B.Vector3(0, 5, -10), this.scene);
    }

    /**
     * Function to override
     * Initialize all entities
     */
    public start(): void {
        // TODO: remove this when finished
        // hide/show the Inspector
        window.addEventListener("keydown", (e: KeyboardEvent): void => {
            // Shift+Ctrl+I
            if (e.shiftKey && e.ctrlKey && e.code === "KeyI") {
                if (Inspector.IsVisible) {
                    Inspector.Hide();
                } else {
                    Inspector.Show(this.scene, {handleResize: true, overlay: true});
                }
            }
        });
    }

    /**
     * Render the scene and update entities
     */
    public update(): void {
        this.scene.render();
        this.entityManager.update();
    }

    /**
     * Destroy the scene and all entities
     */
    public destroy(): void {
        this.mainCamera.dispose();
        this.scene.dispose();
        this.entityManager.destroyAllEntities();
    }
}