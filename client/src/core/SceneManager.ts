import {Scene} from "./Scene";
import {LocalMenuScene} from "../scenes/LocalMenuScene";
import {CatchTheDodoScene} from "../scenes/catchTheDodo/CatchTheDodoScene";
import {GameSelectionScene} from "../scenes/gameSelection/GameSelectionScene";
import {GameOverScene} from "../scenes/gameOver/GameOverScene";
import {MeteoritesScene} from "../scenes/meteoriteGame/MeteoritesScene";
import {EscapeDinoScene} from "../scenes/escapeDino/EscapeDinoScene";

export class SceneManager {
    private static _instance: SceneManager;
    private _scenes: Scene[] = [];
    private _currentScene!: Scene | null;

    private constructor() {}

    public static getInstance(): SceneManager {
        if (!SceneManager._instance) {
            SceneManager._instance = new SceneManager();
        }

        return SceneManager._instance;
    }

    /**
     * Import all scenes and initialize the current scene
     */
    public initializeScenes(): void {
        // add all scenes
        this._scenes.push(new LocalMenuScene());
        this._scenes.push(new CatchTheDodoScene());
        this._scenes.push(new MeteoritesScene());
        this._scenes.push(new EscapeDinoScene());
        this._scenes.push(new GameSelectionScene());
        this._scenes.push(new GameOverScene());

        // set the current scene and start it
        this._currentScene = this._scenes[0];
        this._currentScene.start();
    }

    /**
     * Update the current scene
     */
    public updateCurrentScene(): void {
        if (!this._currentScene) return;
        this._currentScene.update();
    }

    /**
     * Stop the current scene and start the new one
     * @param sceneName
     */
    public changeScene(sceneName: string): void {
        if (this._currentScene) {
            this._currentScene.destroy();
            this._currentScene = null;
        }

        const scene: Scene | undefined = this._scenes.find((scene: Scene): boolean => scene.name === sceneName);
        if (!scene) {
            throw new Error(`Scene ${sceneName} not found`);
        }

        scene.loadAssets().then((): void => {
            scene.start();
            this._currentScene = scene;
        });
    }

    public displayDebugLayer(): void {
        // hide/show the Inspector
        if (this._currentScene?.scene.debugLayer.isVisible()) {
            this._currentScene?.scene.debugLayer.hide();
        } else {
            this._currentScene?.scene.debugLayer.show({overlay: true, handleResize: true});
        }
    }
}