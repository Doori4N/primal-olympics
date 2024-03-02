import {Scene} from "../../core/Scene";
import {NetworkHost} from "../../core/network/NetworkHost";

export class GameSelectionScene extends Scene {
    constructor() {
        super("gameSelection");
    }

    public start(): void {
        if (this.game.isOnline && !this.game.networkInstance) throw new Error("Network instance not found");

        // LOCAL
        if (!this.game.isOnline) {
            if (this.game.events.length <= 0) {
                this.sceneManager.changeScene("gameOver");
                return;
            }

            // choose random game
            const randomGame: string = this.game.events.splice(Math.floor(Math.random() * this.game.events.length), 1)[0];
            this.sceneManager.changeScene(randomGame);
            return;
        }

        // HOST
        if (this.game.isOnline && this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;

            if (this.game.events.length <= 0) {
                networkHost.sendToAllClients("changeScene", "gameOver");
                this.sceneManager.changeScene("gameOver");
                return;
            }

            // choose random game
            const randomGame: string = this.game.events.splice(Math.floor(Math.random() * this.game.events.length), 1)[0];
            networkHost.sendToAllClients("changeScene", randomGame);
            this.sceneManager.changeScene(randomGame);
        }
    }
}