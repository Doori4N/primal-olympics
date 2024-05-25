import {Howl} from "howler";
import {AudioOptions} from "./types";

export class SoundManager {
    private _sounds: {[key: string]: {sound: Howl, baseVolume: number}} = {};

    constructor() {
        this._initSounds();
    }

    private async _initSounds(): Promise<void> {
        this._sounds["click"] = {
            sound: new Howl({src: ["sounds/click.wav"]}),
            baseVolume: 1
        };
        this._sounds["select"] = {
            sound: new Howl({src: ["sounds/select.wav"]}),
            baseVolume: 0.7
        };
        this._sounds["popup"] = {
            sound: new Howl({src: ["sounds/popup.wav"]}),
            baseVolume: 0.7
        };
        this._sounds["jungle"] = {
            sound: new Howl({src: ["sounds/jungle.flac"], loop: true}),
            baseVolume: 0.2
        };
        this._sounds["fireplace"] = {
            sound: new Howl({src: ["sounds/fireplace.wav"], loop: true}),
            baseVolume: .5
        }
        this._sounds["lava-death"] = {
            sound: new Howl({
                src: ["sounds/lava-death.wav"],
                sprite: {
                    lava: [1300, 3422]
                }
            }),
            baseVolume: .7
        }
        this._sounds["lava"] = {
            sound: new Howl({src: ["sounds/lava.wav"], loop: true}),
            baseVolume: .3
        }
        this._sounds["crowd-cheer"] = {
            sound: new Howl({src: ["sounds/crowd-cheer.flac"]}),
            baseVolume: 1
        }
        this._sounds["nightForest"] = {
            sound: new Howl({src: ["sounds/nightForest.wav"], loop: true}),
            baseVolume: 1
        }
        this._sounds["jumpForest"] = {
            sound: new Howl({src: ["sounds/jumpForest.wav"]}),
            baseVolume: 0.3
        }
        this._sounds["walkForest"] = {
            sound: new Howl({src: ["sounds/walkForest2.mp3"]}),
            baseVolume: 0.3
        }
        this._sounds["respiration"] = {
            sound: new Howl({
                src: ["sounds/respirationForest.wav"], 
                loop: true
            }),
            baseVolume: 0.3
        }

        const globalVolume: number = this.getGlobalVolume();
        this.setGlobalVolume(globalVolume);
    }

    public setGlobalVolume(volume: number): void {
        Howler.volume(volume);
        console.log("volume", volume)
        localStorage.setItem("globalVolume", volume.toString());
    }

    public getGlobalVolume(): number {
        return parseFloat(localStorage.getItem("globalVolume") || "0.2");
    }

    public playSound(name: string, options?: AudioOptions): void {
        const sprite: string | undefined = options?.sprite;

        const sound: Howl = this._sounds[name].sound;

        if (options?.fade) {
            const from: number = options.fade.from || this._sounds[name].baseVolume;
            const to: number = options.fade.to || this._sounds[name].baseVolume;
            sound.fade(from, to, options.fade.duration);
        }

        sound.play(sprite);
    }

    public stopSound(name: string, options?: AudioOptions): void {
        const sound: Howl = this._sounds[name].sound;

        if (options?.fade) {
            const from: number = options.fade.from || this._sounds[name].baseVolume;
            const to: number = options.fade.to || this._sounds[name].baseVolume;
            sound.fade(from, to, options.fade.duration);
        }

        sound.stop();
    }
}