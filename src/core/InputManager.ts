import {InputStates, InputType} from "./types";
import * as B from "@babylonjs/core";

const DEADZONE: number = 0.3;

export class InputManager {
    private _gamepadManager: B.GamepadManager;

    // events
    public onGamepadConnected: Function[] = [];
    public onGamepadDisconnected: Function[] = [];

    public inputStates: InputStates = {
        type: InputType.KEYBOARD,
        direction: {
            x: 0,
            y: 0
        },
        buttons: {},
        tick: 0
    };

    constructor() {
        this._gamepadManager = new B.GamepadManager();
        this._listenToKeyboard();
        this._listenToGamepad();
    }

    public updateInputTick(tick: number): void {
        this.inputStates.tick = tick;
    }

    /**
     * Listen to keyboard events and update the inputStates accordingly
     */
    private _listenToKeyboard(): void {
        window.addEventListener("keydown", (event: KeyboardEvent): void => {
            if (this.inputStates.type !== InputType.KEYBOARD) return;

            // update the inputStates
            switch (event.code) {
                case "KeyW":
                    this.inputStates.buttons["up"] = true;
                    break;
                case "KeyS":
                    this.inputStates.buttons["down"] = true;
                    break;
                case "KeyA":
                    this.inputStates.buttons["left"] = true;
                    break;
                case "KeyD":
                    this.inputStates.buttons["right"] = true;
                    break;
                case "Space":
                    this.inputStates.buttons["jump"] = true;
                    break;
                case "ShiftLeft":
                    this.inputStates.buttons["sprint"] = true;
                    break;
            }

            this._updateKeyboardDirections();
        });

        window.addEventListener("keyup", (event: KeyboardEvent): void => {
            if (this.inputStates.type !== InputType.KEYBOARD) return;

            // update the inputStates
            switch (event.code) {
                case "KeyW":
                    this.inputStates.buttons["up"] = false;
                    break;
                case "KeyS":
                    this.inputStates.buttons["down"] = false;
                    break;
                case "KeyA":
                    this.inputStates.buttons["left"] = false;
                    break;
                case "KeyD":
                    this.inputStates.buttons["right"] = false;
                    break;
                case "Space":
                    this.inputStates.buttons["jump"] = false;
                    break;
                case "ShiftLeft":
                    this.inputStates.buttons["sprint"] = false;
                    break;
            }

            this._updateKeyboardDirections();
        });
    }

    private _updateKeyboardDirections(): void {
        // reset directions
        this.inputStates.direction.x = 0;
        this.inputStates.direction.y = 0;

        // update directions
        if (this.inputStates.buttons["up"] && !this.inputStates.buttons["down"]) {
            this.inputStates.direction.y = 1;
        }
        if (this.inputStates.buttons["down"] && !this.inputStates.buttons["up"]) {
            this.inputStates.direction.y = -1;
        }
        if (this.inputStates.buttons["left"] && !this.inputStates.buttons["right"]) {
            this.inputStates.direction.x = -1;
        }
        if (this.inputStates.buttons["right"] && !this.inputStates.buttons["left"]) {
            this.inputStates.direction.x = 1;
        }
    }

    /**
     * Listen to gamepad events and update inputStates accordingly
     */
    private _listenToGamepad(): void {
        this._gamepadManager.onGamepadConnectedObservable.add((gamepad: B.Gamepad): void => {
            // signal that a gamepad has been connected
            this.onGamepadConnected.forEach((callback: Function): void => callback());

            // set inputStates type to gamepad
            this.inputStates = {
                type: InputType.GAMEPAD,
                direction: {
                    x: 0,
                    y: 0
                },
                buttons: {},
                tick: 0
            };

            // PLAYSTATION
            if (gamepad instanceof B.DualShockPad) {
                gamepad.onButtonDownObservable.add((button: number): void => {
                    switch (button) {
                        case B.DualShockButton.Cross:
                            this.inputStates.buttons["jump"] = true;
                            break;
                        case B.DualShockButton.Circle:
                            this.inputStates.buttons["sprint"] = true;
                            break;
                    }
                });

                gamepad.onButtonUpObservable.add((button: number): void => {
                    switch (button) {
                        case B.DualShockButton.Cross:
                            this.inputStates.buttons["jump"] = false;
                            break;
                        case B.DualShockButton.Circle:
                            this.inputStates.buttons["sprint"] = false;
                            break;
                    }
                });
            }

            // GENERIC
            if (gamepad instanceof B.GenericPad) {
                gamepad.onButtonDownObservable.add((button: number): void => {
                    switch (button) {
                        case 0:
                            this.inputStates.buttons["jump"] = true;
                            break;
                        case 1:
                            this.inputStates.buttons["sprint"] = true;
                            break;
                    }
                });

                gamepad.onButtonUpObservable.add((button: number): void => {
                    switch (button) {
                        case 0:
                            this.inputStates.buttons["jump"] = false;
                            break;
                        case 1:
                            this.inputStates.buttons["sprint"] = false;
                            break;
                    }
                });
            }

            // XBOX
            if (gamepad instanceof B.Xbox360Pad) {
                gamepad.onButtonDownObservable.add((button: number): void => {
                    switch (button) {
                        case B.Xbox360Button.A:
                            this.inputStates.buttons["jump"] = true;
                            break;
                        case B.Xbox360Button.X:
                            this.inputStates.buttons["sprint"] = true;
                            break;
                    }
                });

                gamepad.onButtonUpObservable.add((button: number): void => {
                    switch (button) {
                        case B.Xbox360Button.A:
                            this.inputStates.buttons["jump"] = false;
                            break;
                        case B.Xbox360Button.X:
                            this.inputStates.buttons["sprint"] = false;
                            break;
                    }
                });
            }

            // handle left stick
            gamepad.onleftstickchanged((values: B.StickValues): void => {
                if (Math.abs(values.x) < DEADZONE) {
                    this.inputStates.direction.x = 0;
                }
                else {
                    this.inputStates.direction.x = values.x;
                }
                if (Math.abs(values.y) < DEADZONE) {
                    this.inputStates.direction.y = 0;
                }
                else {
                    this.inputStates.direction.y = -values.y;
                }
            });
        });

        this._gamepadManager.onGamepadDisconnectedObservable.add((): void => {
            // signal that a gamepad has been disconnected
            this.onGamepadDisconnected.forEach((callback: Function): void => callback());

            // set inputStates type to keyboard
            this.inputStates = {
                type: InputType.KEYBOARD,
                direction: {
                    x: 0,
                    y: 0
                },
                buttons: {},
                tick: 0
            };
        });
    }

    public cloneInputStates(inputStates: InputStates): InputStates {
        return {
            type: inputStates.type,
            direction: {
                x: inputStates.direction.x,
                y: inputStates.direction.y
            },
            buttons: {
                ...inputStates.buttons
            },
            tick: inputStates.tick
        };
    }
}