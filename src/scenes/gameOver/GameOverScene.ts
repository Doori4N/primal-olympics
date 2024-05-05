import {Scene} from "../../core/Scene";

export class GameOverScene extends Scene {
    constructor() {
        super("gameOver");
    }

    public start(): void {
        const gameOverDiv: Element = document.createElement("div");
        gameOverDiv.id = "msg";
        gameOverDiv.innerHTML = `
            <h1>Game Over</h1>
        `;
        this.game.uiContainer.appendChild(gameOverDiv);
    }
}