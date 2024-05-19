import {Scene} from "../../core/Scene";
import {NetworkHost} from "../../network/NetworkHost";
import {MiniGame} from "../../core/types";
import {Utils} from "../../utils/Utils";

export class GameSelectionScene extends Scene {
    constructor() {
        super("game-selection");
    }

    public start(): void {
        if (!this.game.networkInstance.isHost) return;
        // HOST
        const networkHost = this.game.networkInstance as NetworkHost;

        if (this.game.rounds <= 0) {
            networkHost.sendToAllClients("changeScene", "game-over");
            this.sceneManager.changeScene("game-over");
            this.game.rounds = 2;
            return;
        }

        this.game.rounds--;

        // get all mini-games to play
        let miniGamesToPlay: MiniGame[] = this.game.miniGames.filter((game: MiniGame) => game.toPlay);

        // TODO: reset mini-games to play if all have been played with selected games
        // if all mini-games have been played, reset games selected
        if (miniGamesToPlay.length === 0) {
            miniGamesToPlay = this.game.miniGames.map((game: MiniGame) => {
                if (game.isSelected) game.toPlay = true;
                return game;
            });
        }

        // randomly select a mini-game
        const randomIndex: number = Utils.randomInt(0, miniGamesToPlay.length - 1);
        const randomGame: string = miniGamesToPlay[randomIndex].scene;
        miniGamesToPlay[randomIndex].toPlay = false;

        networkHost.sendToAllClients("changeScene", randomGame);
        this.sceneManager.changeScene(randomGame);
    }
}