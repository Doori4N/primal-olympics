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

export type MiniGame = {
    name: string;
    isSelected: boolean;
    scene: string;
    toPlay: boolean;
}

export type MessageType = "error" | "info" | "success";

export type Commands = {keys: string[], description: string}[];

export type SkinOptions = {
    modelIndex: number;
    skinColorIndex: number;
    hairColorIndex: number;
    outfitColorIndex: number;
}

export type AudioOptions = {
    fade?: {
        from?: number;
        to?: number;
        duration: number;
    },
    sprite?: string;
}