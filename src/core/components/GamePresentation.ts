import {IComponent} from "../IComponent";
import {Entity} from "../Entity";
import {Scene} from "../Scene";
import {INetworkInstance} from "../../network/INetworkInstance";
import {NetworkHost} from "../../network/NetworkHost";
import {InputStates} from "../types";
import {PlayerData} from "../../network/types";

export class GamePresentation implements IComponent {
    public name: string = "GamePresentation";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _timer: number = 30;
    private _isPlayerSkipping!: boolean[];
    private _uiContainer!: Element;
    private readonly _htmlTemplate: string;
    private readonly _networkInstance: INetworkInstance;

    // event listeners
    private _playerSkipEvent = this._onPlayerSkip.bind(this);

    constructor(entity: Entity, scene: Scene, props: {htmlTemplate: string}) {
        this.entity = entity;
        this.scene = scene;
        this._htmlTemplate = props.htmlTemplate;
        this._networkInstance = this.scene.game.networkInstance;
    }

    public onStart(): void {
        if (!this._networkInstance.isHost) {
            this._networkInstance.addEventListener("onPlayerSkip", this._playerSkipEvent);
        }

        this._isPlayerSkipping = new Array(this._networkInstance.players.length).fill(false);

        let uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        this._uiContainer = uiContainer;
        this._displayGUI();

        // countdown interval
        const interval: number = setInterval((): void => {
            this._timer--;
            if (this._timer < 0 || this._isPlayerSkipping.every((isSkipping: boolean): boolean => isSkipping)) {
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

    public onFixedUpdate(): void {
        if (this._networkInstance.isHost) {
            this._checkPlayerSkip();
        }
    }

    public onDestroy(): void {
        this._uiContainer.innerHTML = "";

        if (!this._networkInstance.isHost) {
            this._networkInstance.removeEventListener("onPlayerSkip", this._playerSkipEvent);
        }
    }

    private _displayGUI(): void {
        let playerSkipUI: string = "";
        for (let i: number = 0; i < this._networkInstance.players.length; i++) {
            playerSkipUI += `<p id="playerSkip${i}">${this._networkInstance.players[i].name} : ❌</p>`;
        }

        this._uiContainer.innerHTML = `
            <div id="presentation-ui">
                ${this._htmlTemplate}
                <p>Press Space/X/A to skip</p>
                ${playerSkipUI}
                <p id="timer">Game starts in ${this._timer} seconds</p>
            </div>
        `;
    }

    private _updateTimerUI(): void {
        let timerUI: Element | null = document.querySelector("#timer");
        if (!timerUI) throw new Error("Timer element not found");

        timerUI.innerHTML = `Game starts in ${this._timer} seconds`;
    }

    private _updatePlayerSkipUI(playerIndex: number): void {
        let playerSkipUI: Element | null = document.querySelector(`#playerSkip${playerIndex}`);
        if (!playerSkipUI) throw new Error("Player skip element not found");

        playerSkipUI.innerHTML = `${this._networkInstance.players[playerIndex].name} : ✅`;
    }

    private _checkPlayerSkip(): void {
        const networkHost = this._networkInstance as NetworkHost;

        networkHost.players.forEach((playerData: PlayerData): void => {
            if (playerData.id === networkHost.playerId) return;
            const inputStates: InputStates = networkHost.getPlayerInput(playerData.id);
            if (inputStates.buttons["jump"]) {
                const playerIndex: number = networkHost.players.findIndex((player: {id: string}): boolean => player.id === playerData.id);
                networkHost.sendToAllClients("onPlayerSkip", playerIndex);
                this._onPlayerSkip(playerIndex);
            }
        });

        if (this.scene.game.inputManager.inputStates.buttons["jump"]) {
            const playerIndex: number = networkHost.players.findIndex((player: {id: string}): boolean => player.id === networkHost.playerId);
            networkHost.sendToAllClients("onPlayerSkip", playerIndex);
            this._onPlayerSkip(playerIndex);
        }
    }

    private _onPlayerSkip(playerIndex: number): void {
        this._updatePlayerSkipUI(playerIndex);
        this._isPlayerSkipping[playerIndex] = true;
    }
}