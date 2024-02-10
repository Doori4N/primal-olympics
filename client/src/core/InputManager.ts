import {InputStates, InputType} from "./types";
import * as B from "@babylonjs/core";

const DEADZONE: number = 0.3;

export class InputManager {
    private gamepadManager: B.GamepadManager;

    // events
    public onKeyboardConnected!: Function[];
    public onGamepadConnected!: Function[];
    public onGamepadDisconnected!: Function[];

    public inputMap: InputStates[] = [];

    constructor() {
        this.gamepadManager = new B.GamepadManager();
        this.listenToKeyboard();
        this.listenToGamepad();
    }

    private listenToKeyboard(): void {
        window.addEventListener("keydown", (event: KeyboardEvent): void => {
            const index: number = this.inputMap.findIndex((inputState: InputStates): boolean => inputState.type === InputType.KEYBOARD);
            if (index === -1) {
                this.onKeyboardConnected.forEach((callback: Function): void => callback());
                this.inputMap.push({
                    type: InputType.KEYBOARD,
                    direction: {
                        x: 0,
                        y: 0
                    },
                    buttons: {}
                });
                return;
            }

            switch (event.code) {
                case "ArrowUp":
                    this.inputMap[index].direction.y = 1;
                    break;
                case "ArrowDown":
                    this.inputMap[index].direction.y = -1;
                    break;
                case "ArrowLeft":
                    this.inputMap[index].direction.x = -1;
                    break;
                case "ArrowRight":
                    this.inputMap[index].direction.x = 1;
                    break;
                case "Space":
                    this.inputMap[index].buttons["jump"] = true;
                    break;
            }
        });

        window.addEventListener("keyup", (event: KeyboardEvent): void => {
            const index: number = this.inputMap.findIndex((inputState: InputStates): boolean => inputState.type === InputType.KEYBOARD);
            if (index === -1) return;

            switch (event.code) {
                case "ArrowUp":
                    this.inputMap[index].direction.y = 0;
                    break;
                case "ArrowDown":
                    this.inputMap[index].direction.y = 0;
                    break;
                case "ArrowLeft":
                    this.inputMap[index].direction.x = 0;
                    break;
                case "ArrowRight":
                    this.inputMap[index].direction.x = 0;
                    break;
                case "Space":
                    this.inputMap[index].buttons["jump"] = false;
                    break;
            }
        });
    }

    private listenToGamepad(): void {
        this.gamepadManager.onGamepadConnectedObservable.add((gamepad: B.Gamepad): void => {
            // signal that a gamepad has been connected
            this.onGamepadConnected.forEach((callback: Function): void => callback());

            // add a new inputStates to the inputMap
            this.inputMap.push({
                type: InputType.GAMEPAD,
                direction: {
                    x: 0,
                    y: 0
                },
                buttons: {}
            });

            // get the index of the gamepad
            const index: number = this.inputMap.length - 1;

            // PLAYSTATION
            if (gamepad instanceof B.DualShockPad) {
                gamepad.onButtonDownObservable.add((button: number): void => {
                    switch (button) {
                        case B.DualShockButton.Cross:
                            this.inputMap[index].buttons["jump"] = true;
                            break;
                    }
                });

                gamepad.onButtonUpObservable.add((button: number): void => {
                    switch (button) {
                        case B.DualShockButton.Cross:
                            this.inputMap[index].buttons["jump"] = false;
                            break;
                    }
                });
            }

            // GENERIC
            if (gamepad instanceof B.GenericPad) {
                // TODO: implement
            }

            // XBOX
            if (gamepad instanceof B.Xbox360Pad) {
                gamepad.onButtonDownObservable.add((button: number): void => {
                    switch (button) {
                        case B.Xbox360Button.A:
                            this.inputMap[index].buttons["jump"] = true;
                            break;
                    }
                });

                gamepad.onButtonUpObservable.add((button: number): void => {
                    switch (button) {
                        case B.Xbox360Button.A:
                            this.inputMap[index].buttons["jump"] = false;
                            break;
                    }
                });
            }

            // handle left stick
            gamepad.onleftstickchanged((values: B.StickValues): void => {
                if (Math.abs(this.inputMap[index].direction.x) > DEADZONE) {
                    this.inputMap[index].direction.x = values.x;
                }
                if (Math.abs(this.inputMap[index].direction.y) > DEADZONE) {
                    this.inputMap[index].direction.y = values.y;
                }
            });
        });
    }
}