import {IComponent} from "../IComponent";
import {Entity} from "../Entity";
import {Scene} from "../Scene";


export class GameMessages implements IComponent {
    public name: string = "GameMessages";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _msgDiv!: HTMLDivElement;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this.scene.eventManager.subscribe("onCameraAnimationFinished", this.startCountDown.bind(this, 3));
        this.scene.eventManager.subscribe("onGameFinished", (): void => {
            this.displayMessage("Finished!", 2000, (): void => {
                this.scene.eventManager.notify("onMessageFinished");
            });
        });
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {}

    private startCountDown(duration: number): void {
        this._msgDiv = document.createElement("div");
        this._msgDiv.className = "msg";
        this._msgDiv.innerHTML = `<h1>${duration}</h1>`;
        this.scene.game.uiContainer.appendChild(this._msgDiv);

        let timer: number = duration;
        const interval: number = setInterval((): void => {
            timer--;
            if (timer <= 0) {
                this._updateTimerUI("GO!");

                clearInterval(interval);
                this.scene.eventManager.notify("onGameStarted");

                setTimeout((): void => {
                    this.scene.game.uiContainer.removeChild(this._msgDiv);
                }, 1000);
            }
            else {
                this._updateTimerUI(timer.toString());
            }
        }, 1000);
    }

    private _updateTimerUI(msg: string): void {
        this._msgDiv.innerHTML = `<h1>${msg}</h1>`;
    }

    public displayMessage(msg: string, lifeTime: number, callback?: Function): void {
        const msgDiv: HTMLDivElement = document.createElement("div");
        msgDiv.className = "msg";
        msgDiv.innerHTML = `<h1>${msg}</h1>`;
        this.scene.game.uiContainer.appendChild(msgDiv);
        setTimeout((): void => {
            this.scene.game.uiContainer.removeChild(msgDiv);
            if (callback) callback();
        }, lifeTime);
    }
}