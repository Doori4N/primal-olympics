import {Scene} from "../../core/Scene";

export class SettingsScene extends Scene {
    private _settingsDiv!: HTMLDivElement;

    constructor() {
        super("settings");
    }

    public start(): void {
        this._settingsDiv = document.createElement("div");
        this._settingsDiv.className = "menu-background blur-background";
        this._settingsDiv.innerHTML = `
            <div class="top-border">
               <p class="top-title left-title">Settings</p>
            </div>
            <img src="img/primal-olympics-logo.png" class="bottom-right-logo">
            <div class="bottom-border"></div>
        `;
        this.game.uiContainer.appendChild(this._settingsDiv);

        // back button
        const backBtn: HTMLButtonElement = document.createElement("button");
        backBtn.className = "small-stone-button left-button";
        backBtn.onclick = (): void => {
            this.game.soundManager.playSound("click");
            this.game.fadeIn(this.sceneManager.changeScene.bind(this.sceneManager, "menu"));
        };
        backBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");
        this._settingsDiv.appendChild(backBtn);

        // back button image
        const backImg: HTMLImageElement = document.createElement("img");
        backImg.src = "img/back.png";
        backImg.id = "back-img";
        backBtn.appendChild(backImg);

        this._createSettingsOptions();
    }

    public destroy(): void {
        this.game.uiContainer.removeChild(this._settingsDiv);
        super.destroy();
    }

    private _createSettingsOptions(): void {
        // settings container
        const settingsContainer: HTMLDivElement = document.createElement("div");
        settingsContainer.id = "settings-container";
        this._settingsDiv.appendChild(settingsContainer);

        // fps and ping display
        const fpsPingDiv: HTMLDivElement = document.createElement("div");
        fpsPingDiv.className = "settings-row";
        fpsPingDiv.innerHTML = `<p class="settings-title">Show FPS and Ping: </p>`;
        settingsContainer.appendChild(fpsPingDiv);

        // fps and ping button
        const fpsPingBtn: HTMLButtonElement = document.createElement("button");
        fpsPingBtn.className = "on-off-button";
        fpsPingBtn.innerHTML = localStorage.getItem("showInfoUI") === "false" ? "OFF" : "ON";
        fpsPingDiv.appendChild(fpsPingBtn);

        fpsPingBtn.onclick = (): void => {
            this.game.soundManager.playSound("click");
            if (fpsPingBtn.innerHTML === "ON") {
                fpsPingBtn.innerHTML = "OFF";
                this.game.hideInfoUI();
            } else {
                fpsPingBtn.innerHTML = "ON";
                this.game.showInfoUI();
            }
        }
        fpsPingBtn.onmouseenter = (): void => this.game.soundManager.playSound("select");

        // sound
        const soundDiv: HTMLDivElement = document.createElement("div");
        soundDiv.className = "settings-row";
        soundDiv.innerHTML = `<p class="settings-title">Sound: </p>`;
        settingsContainer.appendChild(soundDiv);

        // sound range
        const soundRange: HTMLInputElement = document.createElement("input");
        soundRange.type = "range";
        soundRange.min = "0";
        soundRange.max = "1";
        soundRange.step = "0.1";
        soundRange.value = this.game.soundManager.getGlobalVolume().toString();
        soundRange.className = "range";
        soundDiv.appendChild(soundRange);

        soundRange.onmouseenter = (): void => this.game.soundManager.playSound("select");
        soundRange.oninput = (): void => {
            this.game.soundManager.playSound("click");
            this.game.soundManager.setGlobalVolume(parseFloat(soundRange.value));
        }
    }
}