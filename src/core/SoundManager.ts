import {Howl} from "howler";
import {AudioOptions} from "./types";

export class SoundManager {
    private _sounds: {[key: string]: {sound: Howl, baseVolume: number}} = {};

    constructor() {
        this._initSounds();
        const globalVolume: number = this.getGlobalVolume();
        this.setGlobalVolume(globalVolume);
    }

    private _initSounds(): void {
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
            baseVolume: .4
        }
        this._sounds["crowd-cheer"] = {
            sound: new Howl({src: ["sounds/crowd-cheer.flac"]}),
            baseVolume: 0.8
        }
        this._sounds["nightForest"] = {
            sound: new Howl({src: ["sounds/nightForest.wav"], loop: true}),
            baseVolume: 1
        }
        this._sounds["jump"] = {
            sound: new Howl({src: ["sounds/jumpForest.wav"]}),
            baseVolume: 0.3
        }
        this._sounds["breath"] = {
            sound: new Howl({
                src: ["sounds/respirationForest.wav"],
                loop: true
            }),
            baseVolume: 0.3
        }
        this._sounds["death"] = {
            sound: new Howl({src: ["sounds/death.mp3"]}),
            baseVolume: 0.2
        }
        this._sounds["crowd"] = {
            sound: new Howl({
                src: ["sounds/crowd_reaction.wav"],
                sprite: {reaction: [3500, 5500]}
            }),
            baseVolume: 0.5
        }
        this._sounds["whistle"] = {
            sound: new Howl({
                src: ["sounds/whistle.wav"],
                sprite: {
                    simpleWhistle: [9000, 1000],
                    longWhistle: [3000, 1500]
                }
            }),
            baseVolume: 0.5
        }
        this._sounds["crowd-ambience"] = {
            sound: new Howl({src: ["sounds/crowd_ambience.wav"], loop: true}),
            baseVolume: 0.3
        }
        this._sounds["kick"] = {
            sound: new Howl({
                src: ["sounds/soccer_ball_kick.wav"],
                sprite: {
                    shoot: [0, 1000],
                    pass: [300, 1000]
                }
            }),
            baseVolume: 0.5
        };
        this._sounds["walking"] = {
            sound: new Howl({
                src: ["sounds/walking.wav"],
                sprite: {
                    walk: [500, 7700, true],
                },
                loop: true,
                rate: 1.1
            }),
            baseVolume: 1
        };
        this._sounds["punch"] = {
            sound: new Howl({src: ["sounds/punch.mp3"]}),
            baseVolume: 0.5
        };
        this._sounds["fast-drum"] = {
            sound: new Howl({src: ["sounds/fast-tribal-drums.wav"]}),
            baseVolume: 0.5
        };
        this._sounds["trex-roar"] = {
            sound: new Howl({src: ["sounds/trex-roar.wav"]}),
            baseVolume: 0.7
        };
        this._sounds["trex-step"] = {
            sound: new Howl({
                src: ["sounds/trex-step.wav"],
                loop: true,
                rate: 2,
                sprite: {
                    step: [0, 19500]
                }
            }),
            baseVolume: 0.5
        };
        this._sounds["trex-bite"] = {
            sound: new Howl({src: ["sounds/trex-bite.wav"]}),
            baseVolume: 0.7
        }
    }

    public setGlobalVolume(volume: number): void {
        Howler.volume(volume);
        localStorage.setItem("globalVolume", volume.toString());
        for (const sound in this._sounds) {
            this._sounds[sound].sound.volume(this._sounds[sound].baseVolume);
        }
    }

    public getGlobalVolume(): number {
        return parseFloat(localStorage.getItem("globalVolume") || "0.2");
    }

    public playSound(name: string, options?: AudioOptions): void {
        const sprite: string | undefined = options?.sprite;

        const sound: Howl = this._sounds[name].sound;

        if (options?.fade) {
            const from: number = options.fade.from ?? this._sounds[name].baseVolume;
            const to: number = options.fade.to ?? this._sounds[name].baseVolume;
            sound.fade(from, to, options.fade.duration);
        }

        sound.play(sprite);
    }

    public stopSound(name: string, options?: AudioOptions): void {
        const sound: Howl = this._sounds[name].sound;

        if (options?.fade) {
            const from: number = options.fade.from ?? this._sounds[name].baseVolume;
            const to: number = options.fade.to ?? this._sounds[name].baseVolume;
            sound.fade(from, to, options.fade.duration);
            sound.once("fade", (): void => {
                sound.stop();
            });
        }
        else {
            sound.stop();
        }
    }

    public isPlaying(name: string): boolean {
        return this._sounds[name].sound.playing();
    }
}