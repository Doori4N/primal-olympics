import * as B from "@babylonjs/core";
import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import {NetworkHost} from "../NetworkHost";
import {AudioOptions} from "../types";

export class NetworkAudioComponent implements IComponent {
    public name: string = "NetworkAudio";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _sounds: {[key: string]: B.Sound};

    constructor(entity: Entity, scene: Scene, props: {sounds: {[key: string]: B.Sound}}) {
        this.entity = entity;
        this.scene = scene;
        this._sounds = props.sounds;
    }

    public onStart(): void {
        if (this.scene.game.networkInstance.isHost) return;

        this.scene.game.networkInstance.addEventListener(`startAudio${this.entity.id}`, this.playSound.bind(this));
        this.scene.game.networkInstance.addEventListener(`stopAudio${this.entity.id}`, this.stopSound.bind(this));
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {}

    public playSound(name: string, options?: AudioOptions): void {
        const sound: B.Sound = this._sounds[name];
        if (sound.isPlaying) this.stopSound(name);

        sound.play(0, options?.offset, options?.duration);

        if (options?.volume) sound.setVolume(options.volume);
        if (options?.fadeOut) {
            setTimeout((): void => {
                sound.setVolume(0, options.fadeOut?.fadeOutDuration);
            }, options.fadeOut.fadeOutDelay * 1000);
        }

        // tell all clients to play the sound
        if (this.scene.game.networkInstance.isHost) {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients(`startAudio${this.entity.id}`, name, options);
        }
    }

    public stopSound(name: string): void {
        const sound: B.Sound = this._sounds[name];
        sound.stop();

        // tell all clients to stop the sound
        if (this.scene.game.networkInstance.isHost) {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients(`stopAudio${this.entity.id}`, name);
        }
    }
}