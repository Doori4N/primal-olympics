import {InputStates} from "../core/types";
import {NetworkHost} from "./NetworkHost";
import {NetworkClient} from "./NetworkClient";
import {Game} from "../core/Game";

export class NetworkInputManager {
    private _game: Game;
    private _inputBuffers = new Map<string, InputStates[]>();
    private _inputBufferSize: number = 3;

    // event listeners
    private _onInputReceivedEvent = this._onInputReceived.bind(this);

    constructor() {
        this._game = Game.getInstance();

        // HOST
        if (this._game.networkInstance.isHost) {
            const networkHost = this._game.networkInstance as NetworkHost;
            networkHost.addEventListener(`inputStates`, this._onInputReceivedEvent);
        }
    }

    public onFixedUpdate(): void {
        // CLIENT
        if (!this._game.networkInstance.isHost) {
            const inputStates: InputStates = this._game.inputManager.cloneInputStates(this._game.inputManager.inputStates);
            this._sendInputStates(inputStates);
        }
        // HOST
        else {
            this._updateInputBuffers();
        }
    }

    private _sendInputStates(inputStates: InputStates): void {
        const networkClient = this._game.networkInstance as NetworkClient;
        networkClient.sendToHost(`inputStates`, this._game.networkInstance.playerId, inputStates);
    }

    private _onInputReceived(playerId: string, inputStates: InputStates): void {
        const inputBuffer = this._inputBuffers.get(playerId);
        if (inputBuffer) {
            inputBuffer.push(inputStates);
        }
        else {
            this._inputBuffers.set(playerId, [inputStates]);
        }
    }

    public getPlayerInput(playerId: string): InputStates[] {
        const inputBuffer = this._inputBuffers.get(playerId)!;

        if (inputBuffer.length === 0) {
            return [];
        }
        else {
            if (inputBuffer.length > this._inputBufferSize) {
                return inputBuffer.slice(0, 2);
            }
            else {
                return [inputBuffer[0]];
            }
        }
    }

    private _updateInputBuffers(): void {
        this._inputBuffers.forEach((inputBuffer: InputStates[], _playerId: string): void => {
            if (inputBuffer.length === 0) return;

            if (inputBuffer.length > this._inputBufferSize) {
                inputBuffer.splice(0, 2);
            }
            else {
                inputBuffer.shift();
            }
        });
    }
}