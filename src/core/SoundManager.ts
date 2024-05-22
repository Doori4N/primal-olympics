import {Howl} from "howler";

export class SoundManager {
    private _sounds: {[key: string]: Howl} = {};

    constructor() {
        this._initSounds();
    }

    private _initSounds(): void {
        this._sounds["click"] = new Howl({
            src: ["sounds/click.wav"],
            volume: 1
        });
        this._sounds["select"] = new Howl({
            src: ["sounds/select.wav"],
            volume: 0.7
        });
        this._sounds["popup"] = new Howl({
            src: ["sounds/popup.wav"],
            volume: 0.7
        });
        this._sounds["jungle"] = new Howl({
            src: ["sounds/jungle.flac"],
            volume: 0.1,
            loop: true
        });
    }

    public playSound(name: string): void {
        const sound: Howl = this._sounds[name];
        sound.play();
    }

    public stopSound(name: string): void {
        const sound: Howl = this._sounds[name];
        sound.stop();
    }
}