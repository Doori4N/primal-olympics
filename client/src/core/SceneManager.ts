import {Scene} from "./Scene";
import {ExampleScene} from "../scenes/ExampleScene";
import {LocalMenuScene} from "../scenes/LocalMenuScene";

export class SceneManager {
    private static instance: SceneManager;
    private scenes: Scene[] = [];
    private currentScene!: Scene;

    private constructor() {}

    public static getInstance(): SceneManager {
        if (!SceneManager.instance) {
            SceneManager.instance = new SceneManager();
        }

        return SceneManager.instance;
    }

    /**
     * Import all scenes and initialize the current scene
     */
    public initializeScenes(): void {
        this.scenes.push(new LocalMenuScene());
        this.scenes.push(new ExampleScene());

        // set the current scene and start it
        this.currentScene = this.scenes[0];
        this.currentScene.start();
    }

    /**
     * Update the current scene
     */
    public updateCurrentScene(): void {
        this.currentScene.update();
    }

    /**
     * Stop the current scene and start the new one
     * @param sceneName
     */
    public changeScene(sceneName: string): void {
        this.currentScene.destroy();

        const scene: Scene | undefined = this.scenes.find((scene: Scene): boolean => scene.name === sceneName);
        if (!scene) {
            throw new Error(`Scene ${sceneName} not found`);
        }

        this.currentScene = scene;
        this.currentScene.start();
    }
}