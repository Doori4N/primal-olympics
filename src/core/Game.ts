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
    public inputManager: InputManager = new InputManager();
    public networkInstance!: INetworkInstance;
    public tick: number = 45; // Number of server updates per second
    public tickIndex: number = 0; // Index of the current tick
    private _timer: number = 0; // Timer to keep track of the time passed since the last tick
    public miniGames: string[] = ["meteorites"];

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
        this.canvas = this._createCanvas();
        this.engine = new B.Engine(this.canvas, true);
        this._resize(this.engine);

        // physics
        const havokInstance: HavokPhysicsWithBindings = await this._getHavokInstance();
        this.physicsPlugin = new B.HavokPlugin(false, havokInstance);

        // scenes
        const sceneManager: SceneManager = SceneManager.getInstance();
        sceneManager.initializeScenes();

        // debug layer
        this._listenToDebugInputs(sceneManager);

        // info ui
        this._createInfoUI();

        // game loop
        this.engine.runRenderLoop((): void => {
            sceneManager.updateCurrentScene();
            this._fixedUpdate(sceneManager);
        });
    }

    /**
     * Update the game with a fixed time step
     */
    private _fixedUpdate(sceneManager: SceneManager): void {
        this._timer += this.engine.getDeltaTime();
        const tickRate: number = 1000 / this.tick;

        while (this._timer >= tickRate) {
            this.tickIndex++;
            this.inputManager.updateInputTick(this.tickIndex);
            sceneManager.fixedUpdateCurrentScene();
            this._timer -= tickRate;
        }
    }

    private _createCanvas(): HTMLCanvasElement {
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.id = "renderCanvas";
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);
        return canvas;
    }

    private async _getHavokInstance(): Promise<HavokPhysicsWithBindings> {
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

    private _resize(engine: B.Engine): void {
        window.addEventListener("resize", (): void => {
            engine.resize();
        });
    }

    /**
     * Listen to inputs to display the debug layer of Babylon.js
     */
    private _listenToDebugInputs(sceneManager: SceneManager): void {
        window.addEventListener("keydown", (e: KeyboardEvent): void => {
            // Shift+Ctrl+I
            if (e.shiftKey && e.ctrlKey && e.code === "KeyI") {
                sceneManager.displayDebugLayer();
            }
        });
    }

    private _createInfoUI(): void {
        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        const infoDiv: HTMLDivElement = document.createElement("div");
        infoDiv.id = "info";
        uiContainer.appendChild(infoDiv);

        const fpsDiv: HTMLDivElement = document.createElement("div");
        fpsDiv.id = "fps";
        infoDiv.appendChild(fpsDiv);

        const pingDiv: HTMLDivElement = document.createElement("div");
        pingDiv.id = "ping";
        infoDiv.appendChild(pingDiv);

        this.engine.onEndFrameObservable.add((): void => {
            fpsDiv.innerText = `FPS: ${this.engine.getFps().toFixed()}`;
            if (this.networkInstance?.isConnected) {
                pingDiv.innerText = `Ping: ${this.networkInstance.ping}ms`;
            }
            else {
                pingDiv.innerText = "Not connected";
            }
        });
    }
}