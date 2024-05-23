import {Howl} from "howler";

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

        await this._waitForSoundsToLoad();

        const globalVolume: number = this.getGlobalVolume();
        this.setGlobalVolume(globalVolume);
    }

    public setGlobalVolume(volume: number): void {
        for (const soundName in this._sounds) {
            const soundOptions = this._sounds[soundName];
            soundOptions.sound.volume(soundOptions.baseVolume * volume);
            localStorage.setItem("globalVolume", volume.toString());
        }
    }

    public getGlobalVolume(): number {
        return parseFloat(localStorage.getItem("globalVolume") || "0.2");
    }

    public playSound(name: string): void {
        const sound: Howl = this._sounds[name].sound;
        sound.play();
    }

    public stopSound(name: string): void {
        const sound: Howl = this._sounds[name].sound;
        sound.stop();
    }

    private async _waitForSoundsToLoad(): Promise<void> {
        const soundsLoadedPromises: Promise<void>[] = [];
        for (const soundName in this._sounds) {
            const sound: Howl = this._sounds[soundName].sound;
            soundsLoadedPromises.push(new Promise((resolve): void => {
                sound.on("load", resolve);
            }));
        }

        await Promise.all(soundsLoadedPromises);
    }
}