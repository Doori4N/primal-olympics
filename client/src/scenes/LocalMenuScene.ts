import {Scene} from "../core/Scene";

export class LocalMenuScene extends Scene {
    constructor() {
        super("LocalMenu");
    }

    public start(): void {
        // PROTOTYPE MENU
        const text: HTMLDivElement = document.createElement("div");
        text.className = "ui";
        text.style.position = "absolute";
        text.style.backgroundColor = "white";
        text.style.zIndex = "10";
        text.style.top = "50%";
        text.style.left = "50%";
        text.style.transform = "translate(-50%, -50%)";
        document.body.appendChild(text);

        this.game.inputs.onKeyboardConnected.push((): void => {
            text.innerHTML += "Keyboard connected<br>";
            this.addPlayer();
        });
        this.game.inputs.onGamepadConnected.push((): void => {
            text.innerHTML += "Gamepad connected<br>";
            this.addPlayer();
        });

        const button: HTMLButtonElement = document.createElement("button");
        button.className = "ui";
        button.innerHTML = "Start Game";
        button.style.position = "absolute";
        button.style.zIndex = "10";
        button.style.top = "50%";
        button.style.left = "50%";
        button.style.transform = "translate(-50%, 0)";
        button.onclick = (): void => {
            if (this.game.playerData.length > 0) {
                this.sceneManager.changeScene("gameSelection");
            }
        }
        document.body.appendChild(button);
    }

    public destroy(): void {
        super.destroy();

        const uiElements = document.querySelectorAll(".ui");
        uiElements.forEach((element: Element): void => {
            element.remove();
        });

        this.game.inputs.onKeyboardConnected = [];
        this.game.inputs.onGamepadConnected = [];
    }

    private addPlayer(): void {
        this.game.playerData.push({
            name: "Player " + (this.game.playerData.length + 1),
            goldMedals: 0,
            silverMedals: 0,
            bronzeMedals: 0
        })
    }
}