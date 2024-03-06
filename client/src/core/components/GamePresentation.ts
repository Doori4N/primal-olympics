import {IComponent} from "../IComponent";
import {Entity} from "../Entity";
import {Scene} from "../Scene";
import {InputStates} from "../types";

export class GamePresentation implements IComponent {
    public name: string = "GamePresentation";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private timer: number = 15;
    private isPlayerSkipping!: boolean[];
    private uiContainer!: Element;
    private htmlTemplate: string;

    constructor(entity: Entity, scene: Scene, props: {htmlTemplate: string}) {
        this.entity = entity;
        this.scene = scene;
        this.htmlTemplate = props.htmlTemplate;
    }

    public onStart(): void {
        this.isPlayerSkipping = new Array(this.scene.game.playerData.length).fill(false);

        let uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        this.uiContainer = uiContainer;
        this.displayGUI();

        // countdown interval
        const interval: number = setInterval((): void => {
            this.timer--;
            if (this.timer < 0 || this.isPlayerSkipping.every((isSkipping: boolean): boolean => isSkipping)) {
                clearInterval(interval);
                this.entity.removeComponent("GamePresentation");
                this.scene.eventManager.notify("onPresentationFinished");
            }
            else {
                this.updateTimerUI();
            }
        }, 1000);
    }

    public onUpdate(): void {
        this.checkPlayerSkip();
    }

    public onTickUpdate(): void {}

    public onDestroy(): void {
        this.uiContainer.innerHTML = "";
    }

    private displayGUI(): void {
        let playerSkipUI: string = "";
        for (let i: number = 0; i < this.scene.game.playerData.length; i++) {
            playerSkipUI += `<p id="playerSkip${i}">Player ${i + 1} : ❌</p>`;
        }

        this.uiContainer.innerHTML = `
            <div id="presentation-ui">
                ${this.htmlTemplate}
                <p>Press Space/X/A to skip</p>
                ${playerSkipUI}
                <p id="timer">Game starts in ${this.timer} seconds</p>
            </div>
        `;
    }

    private updateTimerUI(): void {
        let timerUI: Element | null = document.querySelector("#timer");
        if (!timerUI) throw new Error("Timer element not found");

        timerUI.innerHTML = `Game starts in ${this.timer} seconds`;
    }

    private updatePlayerSkipUI(playerIndex: number): void {
        let playerSkipUI: Element | null = document.querySelector(`#playerSkip${playerIndex}`);
        if (!playerSkipUI) throw new Error("Player skip element not found");

        playerSkipUI.innerHTML = `Player ${playerIndex + 1} : ✅`;
    }

    private checkPlayerSkip(): void {
        // this.scene.game.inputs.inputMap.forEach((input: InputStates, index: number): void => {
        //     if (input.buttons["jump"]) {
        //         this.updatePlayerSkipUI(index);
        //         this.isPlayerSkipping[index] = true;
        //     }
        // });
    }
}