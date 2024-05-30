import * as B from "@babylonjs/core";
import HavokPhysics, {HavokPhysicsWithBindings} from "@babylonjs/havok"
import {SceneManager} from "./SceneManager";
import {InputManager} from "./InputManager";
import {NetworkInstance} from "../network/NetworkInstance";
import {NetworkInputManager} from "../network/NetworkInputManager";
import Peer from "peerjs";
import {LoadingScreen} from "./LoadingScreen";
import {MessageType, MiniGame, SkinOptions} from "./types";
import {SoundManager} from "./SoundManager";

export class Game {
    private static instance: Game;
    public canvas!: HTMLCanvasElement;
    public engine!: B.Engine;
    public inputManager: InputManager = new InputManager();
    public networkInstance!: NetworkInstance;
    public networkInputManager!: NetworkInputManager;
    public soundManager: SoundManager = new SoundManager();
    public peer!: Peer;
    public havokInstance!: HavokPhysicsWithBindings;
    public skinOptions!: SkinOptions;

    public readonly tick: number = 45; // Number of server updates per second
    public tickIndex: number = 0; // Index of the current tick
    private _timer: number = 0; // Timer to keep track of the time passed since the last tick

    public miniGames: MiniGame[] = [
        {name: "Savage Soccer", isSelected: true, scene: "football", toPlay: true},
        {name: "Stellar Storm", isSelected: true, scene: "meteorites", toPlay: true},
        {name: "Downhill Madness", isSelected: true, scene: "slope", toPlay: true},
        {name: "T-Rex Track", isSelected: true, scene: "track-and-field", toPlay: true},
    ];
    public rounds: number = 4;

    public readonly uiContainer: Element = document.querySelector("#ui")!;
    public viewportWidth!: number;
    public viewportHeight!: number;
    private _infoDiv!: HTMLDivElement;

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
        this.viewportHeight = this.canvas.height / 100;
        this.viewportWidth = this.canvas.width / 100;

        this.engine = new B.Engine(this.canvas, true);
        this.engine.loadingScreen = new LoadingScreen();
        this._resize(this.engine);

        // physics
        this.havokInstance = await this._getHavokInstance();

        // scenes
        const sceneManager: SceneManager = SceneManager.getInstance();
        sceneManager.initializeScenes();

        // debug layer
        this._listenToDebugInputs(sceneManager);

        // info ui
        if (localStorage.getItem("showInfoUI") === "true") {
            this.showInfoUI();
        }

        this.skinOptions = this._loadSkinOptions();

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
            if (this.networkInstance?.isConnected) this.networkInputManager.onFixedUpdate();
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

    /**
     * Show the info UI to display fps and ping
     */
    public showInfoUI(): void {
        localStorage.setItem("showInfoUI", "true");

        this._infoDiv = document.createElement("div");
        this._infoDiv.id = "info";
        this.uiContainer.appendChild(this._infoDiv);

        const fpsDiv: HTMLDivElement = document.createElement("div");
        fpsDiv.id = "fps";
        this._infoDiv.appendChild(fpsDiv);

        const pingDiv: HTMLDivElement = document.createElement("div");
        pingDiv.id = "ping";
        this._infoDiv.appendChild(pingDiv);

        // signal icon
        const badSignalIcon: HTMLImageElement = document.createElement("img");
        badSignalIcon.src = "/img/bad-signal.png";
        badSignalIcon.alt = "signal icon";
        badSignalIcon.className = "info-icon";
        pingDiv.appendChild(badSignalIcon);

        const goodSignalIcon: HTMLImageElement = document.createElement("img");
        goodSignalIcon.src = "/img/good-signal.png";
        goodSignalIcon.alt = "signal icon";
        goodSignalIcon.className = "info-icon";

        // ping text
        const pingText: HTMLSpanElement = document.createElement("span");
        pingText.innerText = "Not connected";
        pingText.style.color = "red";
        pingText.className = "info-text";
        pingDiv.appendChild(pingText);

        this.engine.onEndFrameObservable.add((): void => {
            fpsDiv.innerText = `Fps: ${this.engine.getFps().toFixed()}`;

            // ping
            if (this.networkInstance?.isConnected) {
                pingText.innerText = `${this.networkInstance.ping}ms`;
                // change color based on ping
                if (this.networkInstance.ping < 125 && pingDiv.contains(badSignalIcon)) {
                    pingText.style.color = "green";
                    pingDiv.removeChild(badSignalIcon);
                    pingDiv.removeChild(pingText);
                    pingDiv.appendChild(goodSignalIcon);
                    pingDiv.appendChild(pingText);
                }
                else if (this.networkInstance.ping >= 125 && pingDiv.contains(goodSignalIcon)) {
                    pingText.style.color = "red";
                    pingDiv.removeChild(goodSignalIcon);
                    pingDiv.removeChild(pingText);
                    pingDiv.appendChild(badSignalIcon);
                    pingDiv.appendChild(pingText);
                }
            }
            else if (!this.networkInstance?.isConnected && pingDiv.contains(goodSignalIcon)) {
                pingText.style.color = "red";
                pingText.innerText = "Not connected";
                pingDiv.removeChild(goodSignalIcon);
                pingDiv.removeChild(pingText);
                pingDiv.appendChild(badSignalIcon);
                pingDiv.appendChild(pingText);
            }
        });
    }

    public hideInfoUI(): void {
        localStorage.setItem("showInfoUI", "false");
        this.uiContainer.removeChild(this._infoDiv);
    }

    /**
     * Fade in and fade out effect
     * @param callback - Function to call after the fade out effect
     */
    public fadeIn(callback?: (() => void)): void {
        const fadeDiv: HTMLDivElement = document.createElement("div");
        fadeDiv.className = "fade";
        document.body.appendChild(fadeDiv);

        // to trigger the fade-in transition
        setTimeout((): void => {
            fadeDiv.style.opacity = "1";
        }, 100);

        // to trigger the fade-out transition
        setTimeout((): void => {
            fadeDiv.style.opacity = "0";
            if (callback) callback();
        }, 1000);

        setTimeout((): void => {
            fadeDiv.remove();
        }, 1700);
    }

    public displayMessage(message: string, type: MessageType): void {
        const messageDiv: HTMLDivElement = document.createElement("div");
        messageDiv.className = `message ${type}-message`;
        messageDiv.innerHTML = `<p>${message}</p>`;
        document.body.appendChild(messageDiv);

        this.soundManager.playSound("popup");

        messageDiv.addEventListener("animationend", (): void => {
            messageDiv.remove();
        });
    }

    private _loadSkinOptions(): SkinOptions {
        const skinOptionsString: string | null = localStorage.getItem("skinOptions");

        if (!skinOptionsString) {
            return {
                modelIndex: 0,
                skinColorIndex: 0,
                hairColorIndex: 11,
                outfitColorIndex: 1
            }
        }

        return JSON.parse(skinOptionsString);
    }
}