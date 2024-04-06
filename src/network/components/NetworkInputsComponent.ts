import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import {InputStates, InputType} from "../../core/types";
import {NetworkClient} from "../NetworkClient";
import {NetworkHost} from "../NetworkHost";

export class NetworkInputsComponent implements IComponent {
    public name: string = "NetworkInputs";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _inputBuffer: InputStates[] = [];
    private _inputBufferSize: number = 3;

    // event listeners
    private _onInputReceivedEvent = this._onInputReceived.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.addEventListener(`input${this.entity.id}`, this._onInputReceivedEvent);
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.removeEventListener(`input${this.entity.id}`, this._onInputReceivedEvent);
        }
    }

    /**
     * Sends the input states to the host
     */
    public sendInputStates(inputStates: InputStates): void {
        const networkClient = this.scene.game.networkInstance as NetworkClient;
        networkClient.sendToHost(`input${this.entity.id}`, inputStates);
    }

    private _onInputReceived(inputStates: InputStates): void {
        this._inputBuffer.push(inputStates);
    }

    /**
     * Returns an array of InputStates for the current frame
     */
    public getInputs(): InputStates[] {
        if (this._inputBuffer.length === 0) {
            return [{
                type: InputType.KEYBOARD,
                direction: {
                    x: 0,
                    y: 0
                },
                buttons: {},
                tick: 0
            } as InputStates];
        }
        else {
            if (this._inputBuffer.length > this._inputBufferSize) {
                return this._inputBuffer.splice(0, 2);
            }
            else {
                return [this._inputBuffer.shift()!];
            }
        }
    }
}