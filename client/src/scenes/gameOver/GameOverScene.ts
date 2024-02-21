import {Scene} from "../../core/Scene";

export class GameOverScene extends Scene {
    constructor() {
        super("gameOver");
    }

    public start(): void {
        const uiContainer: Element | null = document.querySelector("#ui");
        if (!uiContainer) throw new Error("UI element not found");

        uiContainer.innerHTML = `
            <h1>Game Over</h1>
        `;
    }
}