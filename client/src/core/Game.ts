import * as B from "@babylonjs/core";
import HavokPhysics, {HavokPhysicsWithBindings} from "@babylonjs/havok"
import {SceneManager} from "./SceneManager";
import {InputManager} from "./InputManager";
import {INetworkInstance} from "../network/INetworkInstance";

export class Game {
    private static instance: Game;
    
    public canvas!: HTMLCanvasElement;
    public engine!: B.Engine;
    public physicsPlugin!: B.HavokPlugin;
    public inputs: InputManager = new InputManager();
    public networkInstance!: INetworkInstance;

    /**
     * Server update rate (ms)
     */
    public tickRate: number = 1000 / 15;
    // public events: string[] = ["catchTheDodo", "meteorites", "escapeDino"];
    // public events: string[] = ["catchTheDodo"];
    public events: string[] = ["meteorites"];

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

        this._listenToDebugInputs(sceneManager);

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
            'lib/HavokPhysics.wasm'
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
            engine.resize();
        });
    }

    private _listenToDebugInputs(sceneManager: SceneManager): void {
        window.addEventListener("keydown", (e: KeyboardEvent): void => {
            // Shift+Ctrl+I
            if (e.shiftKey && e.ctrlKey && e.code === "KeyI") {
                sceneManager.displayDebugLayer();
            }
        });
    }
}