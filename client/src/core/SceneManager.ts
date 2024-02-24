import {Scene} from "./Scene";
import {LocalMenuScene} from "../scenes/LocalMenuScene";
import {CatchTheDodoScene} from "../scenes/catchTheDodo/CatchTheDodoScene";
import {GameSelectionScene} from "../scenes/gameSelection/GameSelectionScene";
import {GameOverScene} from "../scenes/gameOver/GameOverScene";
import {MeteoritesScene} from "../scenes/meteoriteGame/MeteoritesScene";

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
        // add all scenes
        this.scenes.push(new LocalMenuScene());
        this.scenes.push(new CatchTheDodoScene());
        this.scenes.push(new MeteoritesScene());
        this.scenes.push(new GameSelectionScene());
        this.scenes.push(new GameOverScene());

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