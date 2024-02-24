import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";

export class GameTimer implements IComponent {
    public name: string = "GameTimer";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _uiContainer!: Element;
    public timer: number = 0;
    public readonly duration: number;
    private _interval!: number;

    constructor(entity: Entity, scene: Scene, props: {duration: number}) {
        this.entity = entity;
        this.scene = scene;
        this.duration = props.duration;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onGameStarted", this._startTimer.bind(this));
    }

    public onUpdate(): void {}

    public onDestroy(): void {}

    private _startTimer(): void {
        let uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");
        this._uiContainer = uiContainer;

        const timerElement: Element = document.createElement("p");
        timerElement.id = "gameTimer";
        timerElement.textContent = `${this.duration} seconds left`;
        this._uiContainer.appendChild(timerElement);

        this.timer = this.duration;

        // countdown interval
        this._interval = setInterval((): void => {
            this.timer--;
            if (this.timer < 0) {
                this.stopTimer();
            }
            else {
                this._updateTimerUI(this.timer);
            }
        }, 1000);
    }

    private _updateTimerUI(time: number): void {
        const timerUI: Element | null = document.querySelector("#gameTimer");
        if (!timerUI) throw new Error("Timer element not found");

        timerUI.textContent = `${time} seconds left`;
    }

    public stopTimer(): void {
        clearInterval(this._interval);
        this._uiContainer.removeChild(document.querySelector("#gameTimer")!);
        this.scene.eventManager.notify("onGameFinished");
    }
}