import {Scene} from "../../core/Scene";
import {NetworkHost} from "../../network/NetworkHost";

export class GameSelectionScene extends Scene {
    constructor() {
        super();
    }

    public start(): void {
        // if client, do nothing
        if (!this.game.networkInstance.isHost) return;

        const networkHost = this.game.networkInstance as NetworkHost;

        if (this.game.miniGames.length <= 0) {
            networkHost.sendToAllClients("changeScene", "gameOver");
            this.sceneManager.changeScene("gameOver");
            return;
        }

        // choose random game
        const randomGame: string = this.game.miniGames.splice(Math.floor(Math.random() * this.game.miniGames.length), 1)[0];
        networkHost.sendToAllClients("changeScene", randomGame);
        this.sceneManager.changeScene(randomGame);
    }
}