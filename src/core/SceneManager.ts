import {Scene} from "./Scene";
import {CatchTheDodoScene} from "../scenes/catchTheDodo/CatchTheDodoScene";
import {GameSelectionScene} from "../scenes/gameSelection/GameSelectionScene";
import {GameOverScene} from "../scenes/gameOver/GameOverScene";
import {MeteoritesScene} from "../scenes/meteoriteGame/MeteoritesScene";
import {MenuScene} from "../scenes/menu/MenuScene";
import {LobbyScene} from "../scenes/lobby/LobbyScene";
import {JoinLobbyScene} from "../scenes/joinLobby/JoinLobbyScene";
import {FootballScene} from "../scenes/footballGame/FootballScene";
import {StartScene} from "../scenes/start/StartScene";
import {SlopeScene} from "../scenes/slopeGame/SlopeScene";
import {CharacterCustomizationScene} from "../scenes/characterCustomization/CharacterCustomizationScene";
import {TrackAndFieldScene} from "../scenes/trackAndFieldGame/TrackAndFieldScene";

export class SceneManager {
    private static _instance: SceneManager;
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
        // start the first scene
        const scene: Scene = this._createScene("start");
        this._loadAndStartScene(scene);
    }

    /**
     * Update the current scene
     */
    public updateCurrentScene(): void {
        if (!this._currentScene) return;
        this._currentScene.update();
    }

    public fixedUpdateCurrentScene(): void {
        if (!this._currentScene) return;
        this._currentScene.fixedUpdate();
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

        const newScene: Scene = this._createScene(sceneName);
        this._loadAndStartScene(newScene);
    }

    private _loadAndStartScene(scene: Scene): void {
        scene.preload().then((): void => {
            this._currentScene = scene;
            this._currentScene.start();
        });
    }

    private _createScene(sceneName: string): Scene {
        switch (sceneName) {
            case "start":
                return new StartScene();
            case "menu":
                return new MenuScene();
            case "game-selection":
                return new GameSelectionScene();
            case "lobby":
                return new LobbyScene();
            case "join-lobby":
                return new JoinLobbyScene();
            case "game-over":
                return new GameOverScene();
            case "character-customization":
                return new CharacterCustomizationScene();
            case "catch-the-dodo":
                return new CatchTheDodoScene();
            case "meteorites":
                return new MeteoritesScene();
            case "football":
                return new FootballScene();
            case "slope":
                return new SlopeScene();
            case "track-and-field":
                return new TrackAndFieldScene();
            default:
                throw new Error("Scene not found");
        }
    }

    public displayDebugLayer(): void {
        // hide/show the Inspector
        if (this._currentScene?.babylonScene.debugLayer.isVisible()) {
            this._currentScene?.babylonScene.debugLayer.hide();
        } else {
            this._currentScene?.babylonScene.debugLayer.show({overlay: true, handleResize: true});
        }
    }
}