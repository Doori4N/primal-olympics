import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";

export class GameTimer implements IComponent {
    public name: string = "GameTimer";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private uiContainer!: Element;
    private readonly duration: number;

    constructor(entity: Entity, scene: Scene, props: {duration: number}) {
        this.entity = entity;
        this.scene = scene;
        this.duration = props.duration;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onPresentationFinished", this.startTimer.bind(this));
    }

    public onUpdate(): void {}

    public onDestroy(): void {}

    private startTimer(): void {
        let uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");
        this.uiContainer = uiContainer;

        this.uiContainer.innerHTML = `<p id="gameTimer">${this.duration} seconds left</p>`;

        let timer: number = this.duration;

        // countdown interval
        const interval: number = setInterval((): void => {
            timer--;
            if (timer < 0) {
                clearInterval(interval);
                this.uiContainer.innerHTML = "";
                this.scene.eventManager.notify("onGameFinished");
            }
            else {
                this.updateTimerUI(timer);
            }
        }, 1000);
    }

    private updateTimerUI(time: number): void {
        const timerUI: Element | null = document.querySelector("#gameTimer");
        if (!timerUI) throw new Error("Timer element not found");

        timerUI.textContent = `${time} seconds left`;
    }
}