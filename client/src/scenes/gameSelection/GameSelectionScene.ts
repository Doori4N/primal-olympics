import {Scene} from "../../core/Scene";

export class GameSelectionScene extends Scene {
    constructor() {
        super("gameSelection");
    }

    public start(): void {
        super.start();

        if (this.game.events.length <= 0) {
            this.sceneManager.changeScene("gameOver");
            return;
        }

        // choose random game
        const randomGame: string = this.game.events.splice(Math.floor(Math.random() * this.game.events.length), 1)[0];
        this.sceneManager.changeScene(randomGame);
    }
}