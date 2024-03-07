export type NetworkMessage = {
    type: string;
    data: any;
}

export type TransformUpdate = {
    position: {
        x: number;
        y: number;
        z: number;
    };
    rotation: {
        x: number;
        y: number;
        z: number;
    };
}

export type PlayerData = {
    id: string;
    name: string;
    goldMedals: number;
    silverMedals: number;
    bronzeMedals: number;
}