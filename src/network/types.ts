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
        w: number;
    };
    velocity?: {
        x: number;
        y: number;
        z: number;
    };
}

export type PhysicsUpdate = {
    linearVelocity: {
        x: number;
        y: number;
        z: number;
    };
    transform: TransformUpdate;
}

export type PlayerData = {
    id: string;
    name: string;
    goldMedals: number;
    silverMedals: number;
    bronzeMedals: number;
}

export type AnimationOptions = {
    loop?: boolean,
    from?: number,
    to?: number,
    speedRatio?: number,
    smoothTransition?: boolean,
    transitionSpeed?: number
}

export type AudioOptions = {
    offset?: number,
    duration?: number,
    volume?: number,
    fade?: {
        fadeVolume: number,
        fadeOutDuration: number,
        fadeOutDelay: number,
    }
}