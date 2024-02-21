import {InputStates, InputType} from "./types";
import * as B from "@babylonjs/core";

const DEADZONE: number = 0.3;

export class InputManager {
    private gamepadManager: B.GamepadManager;

    // events
    public onKeyboardConnected: Function[] = [];
    public onGamepadConnected: Function[] = [];
    public onGamepadDisconnected: Function[] = [];

    public inputMap: InputStates[] = [];

    constructor() {
        this.gamepadManager = new B.GamepadManager();
        this.listenToKeyboard();
        this.listenToGamepad();
    }

    /**
     * Listen to keyboard events and update the inputMap accordingly
     */
    private listenToKeyboard(): void {
        window.addEventListener("keydown", (event: KeyboardEvent): void => {
            const index: number = this.inputMap.findIndex((inputState: InputStates): boolean => inputState.type === InputType.KEYBOARD);

            // if no keyboard inputStates are found, add a new one (this should only happen once)
            if (index === -1) {
                // signal that a keyboard has been connected
                this.onKeyboardConnected.forEach((callback: Function): void => callback());

                // add a new inputStates to the inputMap
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

            // update the inputStates
            switch (event.key) {
                case "z":
                    this.inputMap[index].buttons["up"] = true;
                    break;
                case "s":
                    this.inputMap[index].buttons["down"] = true;
                    break;
                case "q":
                    this.inputMap[index].buttons["left"] = true;
                    break;
                case "d":
                    this.inputMap[index].buttons["right"] = true;
                    break;
                case " ":
                    this.inputMap[index].buttons["jump"] = true;
                    break;
            }

            this.updateKeyboardDirections(index);
        });

        window.addEventListener("keyup", (event: KeyboardEvent): void => {
            const index: number = this.inputMap.findIndex((inputState: InputStates): boolean => inputState.type === InputType.KEYBOARD);
            if (index === -1) return;

            // update the inputStates
            switch (event.key) {
                case "z":
                    this.inputMap[index].buttons["up"] = false;
                    break;
                case "s":
                    this.inputMap[index].buttons["down"] = false;
                    break;
                case "q":
                    this.inputMap[index].buttons["left"] = false;
                    break;
                case "d":
                    this.inputMap[index].buttons["right"] = false;
                    break;
                case " ":
                    this.inputMap[index].buttons["jump"] = false;
                    break;
            }

            this.updateKeyboardDirections(index);
        });
    }

    private updateKeyboardDirections(index: number): void {
        // reset directions
        this.inputMap[index].direction.x = 0;
        this.inputMap[index].direction.y = 0;

        // update directions
        if (this.inputMap[index].buttons["up"] && !this.inputMap[index].buttons["down"]) {
            this.inputMap[index].direction.y = -1;
        }
        if (this.inputMap[index].buttons["down"] && !this.inputMap[index].buttons["up"]) {
            this.inputMap[index].direction.y = 1;
        }
        if (this.inputMap[index].buttons["left"] && !this.inputMap[index].buttons["right"]) {
            this.inputMap[index].direction.x = -1;
        }
        if (this.inputMap[index].buttons["right"] && !this.inputMap[index].buttons["left"]) {
            this.inputMap[index].direction.x = 1;
        }
    }

    /**
     * Listen to gamepad events and update the inputMap accordingly
     */
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
                gamepad.onButtonDownObservable.add((button: number): void => {
                    switch (button) {
                        case 0:
                            this.inputMap[index].buttons["jump"] = true;
                            break;
                    }
                });

                gamepad.onButtonUpObservable.add((button: number): void => {
                    switch (button) {
                        case 0:
                            this.inputMap[index].buttons["jump"] = false;
                            break;
                    }
                });
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
                if (Math.abs(values.x) < DEADZONE) {
                    this.inputMap[index].direction.x = 0;
                }
                else {
                    this.inputMap[index].direction.x = values.x;
                }
                if (Math.abs(values.y) < DEADZONE) {
                    this.inputMap[index].direction.y = 0;
                }
                else {
                    this.inputMap[index].direction.y = values.y;
                }
            });
        });
    }
}