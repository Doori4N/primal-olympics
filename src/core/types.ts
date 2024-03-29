export type InputStates = {
    type: InputType;
    direction: {
        x: number;
        y: number;
    };
    buttons: {[key: string]: boolean};
    tick: number;
}

export enum InputType {
    KEYBOARD,
    GAMEPAD
}