import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {PlayerData} from "../../../network/types";
import {NetworkInstance} from "../../../network/NetworkInstance";
import {NetworkHost} from "../../../network/NetworkHost";

export class GameScores implements IComponent {
    public name: string = "GameScores";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _scores: {playerData: PlayerData, position: number}[] = [];
    private readonly _networkInstance: NetworkInstance;

    // event listeners
    private _setPlayerScoreEvent = this.setPlayerScore.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
        this._networkInstance = this.scene.game.networkInstance;
    }

    public onStart(): void {
        // CLIENT
        if (!this._networkInstance.isHost) {
            this._networkInstance.addEventListener("onSetPlayerScore", this._setPlayerScoreEvent);
        }

        this.scene.eventManager.subscribe("onMessageFinished", this._displayEventScores.bind(this));
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        // CLIENT
        if (!this._networkInstance.isHost) {
            this._networkInstance.removeEventListener("onSetPlayerScore", this._setPlayerScoreEvent);
        }
    }

    public setPlayerScore(playerData: PlayerData): void {
        this._scores.push({
            playerData: playerData,
            position: this._networkInstance.players.length - this._scores.length
        });

        // HOST
        if (this._networkInstance.isHost) {
            const networkHost = this._networkInstance as NetworkHost;
            networkHost.sendToAllClients("onSetPlayerScore", playerData);
        }

        // check if all players have finished
        if (this._scores.length === this._networkInstance.players.length) {
            this.scene.eventManager.notify("onGameFinished");
        }
    }

    private _displayEventScores(): void {
        this._scores.sort((a, b) => b.position - a.position);

        // HOST
        if (this._networkInstance.isHost) {
            this.setPlayerMedals();

            // updates medals for other clients
            const networkHost = this._networkInstance as NetworkHost;
            networkHost.sendToAllClients("onUpdatePlayers", {players: this._networkInstance.players});
        }

        setTimeout((): void => {
            this.scene.eventManager.notify("onDisplayLeaderboard");
        }, 5000);
    }

    private setPlayerMedals(): void {
        for (let i: number = 0; i < this._scores.length; i++) {
            switch (i) {
                case 0:
                    this._scores[i].playerData.goldMedals++;
                    break;
                case 1:
                    this._scores[i].playerData.silverMedals++;
                    break;
                case 2:
                    this._scores[i].playerData.bronzeMedals++;
                    break;
                default:
                    break;
            }
        }
    }
}