import {IComponent} from "../IComponent";
import {Entity} from "../Entity";
import {Scene} from "../Scene";

export class GameTimer implements IComponent {
    public name: string = "GameTimer";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _timerDiv!: HTMLDivElement;
    private _timerText!: HTMLParagraphElement;
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

    public onFixedUpdate(): void {}

    public onDestroy(): void {}

    private _startTimer(): void {
        this._timerDiv = document.createElement("div");
        this._timerDiv.id = "game-timer";
        this.scene.game.uiContainer.appendChild(this._timerDiv);

        const stopWatch: HTMLImageElement = document.createElement("img");
        stopWatch.id = "stopwatch-img";
        stopWatch.src = "img/stopwatch.png";
        stopWatch.alt = "stopwatch";
        this._timerDiv.appendChild(stopWatch);

        this._timerText = document.createElement("p");
        this._timerText.id = "timer-text";
        this._timerText.textContent = `${this.duration}`;
        this._timerDiv.appendChild(this._timerText);

        this.timer = this.duration;

        // countdown interval
        this._interval = setInterval((): void => {
            this.timer--;
            if (this.timer < 0) {
                this.stopTimer();
            }
            else {
                this._timerText.innerHTML = `${this.timer}`;
                if (this.timer < 10) {
                    this._timerText.style.color = "red";
                }
            }
        }, 1000);
    }

    public stopTimer(): void {
        clearInterval(this._interval);
        this.scene.game.uiContainer.removeChild(this._timerDiv);
        this.scene.eventManager.notify("onGameFinished");
    }
}