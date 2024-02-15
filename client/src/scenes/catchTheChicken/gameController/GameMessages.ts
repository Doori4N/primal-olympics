import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";


export class GameMessages implements IComponent {
    public name: string = "GameMessages";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private uiContainer!: Element;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        this.uiContainer = uiContainer;

        this.scene.eventManager.subscribe("onCameraAnimationFinished", this.startCountDown.bind(this, 3));
        this.scene.eventManager.subscribe("onGameFinished", this.displayGameOver.bind(this));
    }

    public onUpdate(): void {}

    public onDestroy(): void {}

    private startCountDown(duration: number): void {
        this.uiContainer.innerHTML = `<p id="timer">${duration}</p>`;

        let timer: number = duration;
        const interval: number = setInterval((): void => {
            timer--;
            if (timer <= 0) {
                this.updateTimerUI("GO!");

                clearInterval(interval);
                this.scene.eventManager.notify("onGameStarted");

                setTimeout((): void => {
                    this.uiContainer.innerHTML = "";
                }, 1000);
            }
            else {
                this.updateTimerUI(timer.toString());
            }
        }, 1000);
    }

    private updateTimerUI(msg: string): void {
        const timerUI: Element | null = document.querySelector("#timer");
        if (!timerUI) throw new Error("Timer element not found");

        timerUI.textContent = msg;
    }

    private displayGameOver(): void {
        this.uiContainer.innerHTML = "<p>Finished!</p>";
        setTimeout((): void => {
            this.uiContainer.innerHTML = "";
            this.scene.eventManager.notify("onMessageFinished");
        }, 2000);
    }
}