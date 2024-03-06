import {IComponent} from "../IComponent";
import {Entity} from "../Entity";
import {Scene} from "../Scene";
import {INetworkInstance} from "../../network/INetworkInstance";
import {NetworkHost} from "../../network/NetworkHost";

export class GamePresentation implements IComponent {
    public name: string = "GamePresentation";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private timer: number = 30;
    private isPlayerSkipping!: boolean[];
    private uiContainer!: Element;
    private htmlTemplate: string;
    private _networkInstance: INetworkInstance;

    // event listeners
    private _playerSkipEvent = this._onPlayerSkip.bind(this);

    constructor(entity: Entity, scene: Scene, props: {htmlTemplate: string}) {
        this.entity = entity;
        this.scene = scene;
        this.htmlTemplate = props.htmlTemplate;
        this._networkInstance = this.scene.game.networkInstance;
    }

    public onStart(): void {
        if (!this._networkInstance.isHost) {
            this._networkInstance.addEventListener("onPlayerSkip", this._playerSkipEvent);
        }

        this.isPlayerSkipping = new Array(this._networkInstance.players.length).fill(false);

        let uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        this.uiContainer = uiContainer;
        this._displayGUI();

        // countdown interval
        const interval: number = setInterval((): void => {
            this.timer--;
            if (this.timer < 0 || this.isPlayerSkipping.every((isSkipping: boolean): boolean => isSkipping)) {
                clearInterval(interval);
                this.entity.removeComponent("GamePresentation");
                this.scene.eventManager.notify("onPresentationFinished");
            }
            else {
                this._updateTimerUI();
            }
        }, 1000);
    }

    public onUpdate(): void {}

    public onTickUpdate(): void {
        if (this._networkInstance.isHost) {
            this._checkPlayerSkip();
        }
    }

    public onDestroy(): void {
        this.uiContainer.innerHTML = "";

        if (!this._networkInstance.isHost) {
            this._networkInstance.removeEventListener("onPlayerSkip", this._playerSkipEvent);
        }
    }

    private _displayGUI(): void {
        let playerSkipUI: string = "";
        for (let i: number = 0; i < this._networkInstance.players.length; i++) {
            playerSkipUI += `<p id="playerSkip${i}">${this._networkInstance.players[i].name} : ❌</p>`;
        }

        this.uiContainer.innerHTML = `
            <div id="presentation-ui">
                ${this.htmlTemplate}
                <p>Press Space/X/A to skip</p>
                ${playerSkipUI}
                <p id="timer">Game starts in ${this.timer} seconds</p>
            </div>
        `;
    }

    private _updateTimerUI(): void {
        let timerUI: Element | null = document.querySelector("#timer");
        if (!timerUI) throw new Error("Timer element not found");

        timerUI.innerHTML = `Game starts in ${this.timer} seconds`;
    }

    private _updatePlayerSkipUI(playerIndex: number): void {
        let playerSkipUI: Element | null = document.querySelector(`#playerSkip${playerIndex}`);
        if (!playerSkipUI) throw new Error("Player skip element not found");

        playerSkipUI.innerHTML = `${this._networkInstance.players[playerIndex].name} : ✅`;
    }

    private _checkPlayerSkip(): void {
        const networkHost = this._networkInstance as NetworkHost;
        for (const playerId in networkHost.playerInputs) {
            if (networkHost.playerInputs[playerId].buttons["jump"]) {
                const playerIndex: number = networkHost.players.findIndex((player: {id: string}): boolean => player.id === playerId);
                networkHost.sendToAllClients("onPlayerSkip", playerIndex);
                this._onPlayerSkip(playerIndex);
            }
        }
        if (this.scene.game.inputs.inputStates.buttons["jump"]) {
            const playerIndex: number = networkHost.players.findIndex((player: {id: string}): boolean => player.id === networkHost.playerId);
            networkHost.sendToAllClients("onPlayerSkip", playerIndex);
            this._onPlayerSkip(playerIndex);
        }
    }

    private _onPlayerSkip(playerIndex: number): void {
        this._updatePlayerSkipUI(playerIndex);
        this.isPlayerSkipping[playerIndex] = true;
    }
}