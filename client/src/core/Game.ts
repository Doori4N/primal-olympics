import * as B from "@babylonjs/core";
import HavokPhysics, {HavokPhysicsWithBindings} from "@babylonjs/havok"
import {SceneManager} from "./SceneManager";
import {InputManager} from "./InputManager";
import {playerData} from "./types";

export class Game {
    private static instance: Game;
    
    public canvas!: HTMLCanvasElement;
    public engine!: B.Engine;
    public physicsPlugin!: B.HavokPlugin;
    public inputs: InputManager = new InputManager();
    public playerData: playerData[] = [];
    public events: string[] = ["catchTheDodo"];

    private constructor() {}

    public static getInstance(): Game {
        if (!Game.instance) {
            Game.instance = new Game();
        }
        return Game.instance;
    }

    /**
     * Initialize the game and start the game loop
     */
    public async start(): Promise<void> {
        // canvas
        this.canvas = this.createCanvas();
        this.engine = new B.Engine(this.canvas, true);
        this.resize(this.engine);

        // physics
        const havokInstance: HavokPhysicsWithBindings = await this.getHavokInstance();
        this.physicsPlugin = new B.HavokPlugin(true, havokInstance);

        // scenes
        const sceneManager: SceneManager = SceneManager.getInstance();
        sceneManager.initializeScenes();

        // game loop
        this.engine.runRenderLoop((): void => {
            sceneManager.updateCurrentScene();
        });
    }

    /**
     * Create a canvas element and append it to the document body
     */
    private createCanvas(): HTMLCanvasElement {
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.id = "renderCanvas";
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);
        return canvas;
    }

    /**
     * Load the Havok physics plugin
     */
    private async getHavokInstance(): Promise<HavokPhysicsWithBindings> {
        // load physics plugin
        // doesn't work with the following code
        // const havokInstance: HavokPhysicsWithBindings = await HavokPhysics();

        // TODO: change this to a more elegant solution
        // dirty hack to get the wasm file to load
        const wasmBinary: Response = await fetch(
            './node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm'
        );
        const wasmBinaryArrayBuffer: ArrayBuffer = await wasmBinary.arrayBuffer();
        const havokInstance: HavokPhysicsWithBindings = await HavokPhysics({
            wasmBinary: wasmBinaryArrayBuffer,
        });

        return havokInstance;
    }

    /**
     * Resize the canvas when the window is resized
     * @param engine
     */
    private resize(engine: B.Engine): void {
        window.addEventListener("resize", (): void => {
            console.log("resize event detected!")
            engine.resize();
        });
    }
}