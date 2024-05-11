import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import {PlayerBehaviour} from "./PlayerBehaviour";
import {GameTimer} from "../../../core/components/GameTimer";
import {PlayerData} from "../../../network/types";
import {NetworkInstance} from "../../../network/NetworkInstance";
import {NetworkHost} from "../../../network/NetworkHost";

export class GameScores implements IComponent {
    public name: string = "GameScores";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _scores: {playerData: PlayerData, score: number}[] = [];
    private _deadPlayers: number = 0;
    private _gameTimer!: GameTimer;
    private readonly _networkInstance: NetworkInstance;

    // event listeners
    private _setPlayerScoreEvent = this._setPlayerScoreClientRpc.bind(this);
    private _updatePlayersEvent = this._updatePlayersClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
        this._networkInstance = this.scene.game.networkInstance;
    }

    public onStart(): void {
        if (!this._networkInstance.isHost) {
            this._networkInstance.addEventListener("onSetPlayerScore", this._setPlayerScoreEvent);
            this._networkInstance.addEventListener("onUpdatePlayers", this._updatePlayersEvent);
        }

        this.scene.eventManager.subscribe("onGameStarted", this._initScores.bind(this));
        this.scene.eventManager.subscribe("onMessageFinished", this.displayEventScores.bind(this));

        const gameController: Entity | null = this.scene.entityManager.getFirstEntityByTag("gameManager");
        if (!gameController) throw new Error("Game controller not found");
        this._gameTimer = gameController.getComponent("GameTimer") as GameTimer;
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        if (!this._networkInstance.isHost) {
            this._networkInstance.removeEventListener("onSetPlayerScore", this._setPlayerScoreEvent);
            this._networkInstance.removeEventListener("onUpdatePlayers", this._updatePlayersEvent);
        }
    }

    private _initScores(): void {
        this._networkInstance.players.forEach((playerData: PlayerData): void => {
            this._scores.push({
                playerData: playerData,
                score: 0
            });
        });
    }

    public setPlayerScore(playerEntity: Entity): void {
        const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
        const playerData: PlayerData = this._networkInstance.players.find((playerData: PlayerData): boolean => playerData.id === playerBehaviourComponent.playerId)!;

        const playerScore = this._scores.find((score): boolean => score.playerData.id === playerData.id)!;
        playerScore.score = this._gameTimer.timer;

        const networkHost = this._networkInstance as NetworkHost;
        networkHost.sendToAllClients("onSetPlayerScore", {playerId: playerData.id, score: playerScore.score});

        this._deadPlayers++;
        this.checkGameOver();
    }

    private checkGameOver(): void {
        // check if all players are dead
        if (this._deadPlayers === this._scores.length) {
            this._gameTimer.stopTimer();
        }
    }

    private displayEventScores(): void {
        this._scores.sort((a, b) => a.score - b.score);

        if (this._networkInstance.isHost) {
            this.setPlayerMedals();
        }

        setTimeout((): void => {
            this.scene.eventManager.notify("onDisplayLeaderboard");
        }, 5000);
    }

    private setPlayerMedals(): void {
        for (let i: number = 0; i < this._scores.length; i++) {
            switch (i) {
                case 0:
                    console.log("First place: ", this._scores[i].playerData.name);
                    this._scores[i].playerData.goldMedals++;
                    break;
                case 1:
                    console.log("Second place: ", this._scores[i].playerData.name);
                    this._scores[i].playerData.silverMedals++;
                    break;
                case 2:
                    console.log("Third place: ", this._scores[i].playerData.name);
                    this._scores[i].playerData.bronzeMedals++;
                    break;
                default:
                    console.log("No medals: ", this._scores[i].playerData.name);
                    break;
            }
        }

        const networkHost = this._networkInstance as NetworkHost;
        networkHost.sendToAllClients("onUpdatePlayers", {players: this._networkInstance.players});
    }

    private _setPlayerScoreClientRpc(args: {playerId: string, score: number}): void {
        const playerScore = this._scores.find((score): boolean => score.playerData.id === args.playerId)!;
        playerScore.score = args.score;

        this._deadPlayers++;
        this.checkGameOver();
    }

    private _updatePlayersClientRpc(args: {players: PlayerData[]}): void {
        this._networkInstance.players = args.players;
    }
}