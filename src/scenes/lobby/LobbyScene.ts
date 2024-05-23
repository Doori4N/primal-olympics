import {Scene} from "../../core/Scene";
import {NetworkHost} from "../../network/NetworkHost";
import {NetworkClient} from "../../network/NetworkClient";
import {PlayerData} from "../../network/types";
import * as B from "@babylonjs/core";
import {Entity} from "../../core/Entity";
import {MeshComponent} from "../../core/components/MeshComponent";
import {NetworkAnimationComponent} from "../../network/components/NetworkAnimationComponent";
import * as GUI from "@babylonjs/gui";
import {GameSelectionUI} from "./components/GameSelectionUI";
import {GameLobbyUI} from "./components/GameLobbyUI";
import {Utils} from "../../utils/Utils";

export class LobbyScene extends Scene {
    private _gui!: GUI.AdvancedDynamicTexture;
    private _playersTransform: {position: B.Vector3, rotation: B.Vector3}[] = [
        {position: new B.Vector3(8.825, 0, 5.8), rotation: new B.Vector3(0, 1.8, 0)},
        {position: new B.Vector3(-9.7, 0, 7), rotation: new B.Vector3(0, -1.5, 0)},
        {position: new B.Vector3(8.290, 0, 14.368), rotation: new B.Vector3(0, 1.2, 0)},
        {position: new B.Vector3(-9.5, 0, 13.9), rotation: new B.Vector3(0, -1.2, 0)},
        {position: new B.Vector3(15.2, 0, 7.5), rotation: new B.Vector3(0, 1.6, 0)},
        {position: new B.Vector3(-15.9, 0, 7.5), rotation: new B.Vector3(0, -1.6, 0)},
        {position: new B.Vector3(13.7, 0, -2.7), rotation: new B.Vector3(0, 2, 0)},
        {position: new B.Vector3(-13.4, 0, -0.5), rotation: new B.Vector3(0, -1.8, 0)}
    ];
    private _players = new Map<string, {entity: Entity, text: GUI.TextBlock}>();
    private _gameManager!: Entity;
    private _roomId!: string;

    // event listeners
    private _addPlayerEvent = this._addPlayer.bind(this);
    private _removePlayerEvent = this._removePlayer.bind(this);
    private _getPlayersEvent = this._getPlayersHostRpc.bind(this);
    private _setPlayersEvent = this._setPlayersClientRpc.bind(this);
    private _hostDisconnectedEvent = this._onHostDisconnected.bind(this);

    constructor() {
        super("lobby");
    }

    public async preload(): Promise<void> {
        this.game.engine.displayLoadingUI();

        this.loadedAssets["caveman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "caveman.glb", this.babylonScene);
        this.loadedAssets["cavewoman"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/models/", "cavewoman.glb", this.babylonScene);
        this.loadedAssets["lobbyScene"] = await B.SceneLoader.LoadAssetContainerAsync("meshes/scenes/", "lobbyScene.glb", this.babylonScene);

        this.game.engine.hideLoadingUI();
    }

    public start(): void {
        this.game.soundManager.stopSound("jungle");

        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.babylonScene);

        // camera
        this.mainCamera.rotation = new B.Vector3(0, Math.PI, 0);
        this.mainCamera.position.z = 40;
        this.mainCamera.position.y = 20;
        this.mainCamera.position.x = 3;
        this.mainCamera.rotation.x = 0.4;

        // light
        const light = new B.HemisphericLight("light1", new B.Vector3(0, 1, 0), this.babylonScene);
        light.intensity = 0.7;

        this._createCave();

        if (this.game.networkInstance.isHost) this._handleHost();
        else this._handleClient();

        this._gameManager = new Entity("gameManager");
        this._gameManager.addComponent(new GameLobbyUI(this._gameManager, this, {roomId: this._roomId}));
        this._gameManager.addComponent(new GameSelectionUI(this._gameManager, this));
        this.entityManager.addEntity(this._gameManager);
    }

    public destroy(): void {
        this.game.soundManager.stopSound("fireplace");
        this._gui.dispose();

        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.removeEventListener("player-joined", this._addPlayer);
            networkHost.removeEventListener("player-left", this._removePlayer);
            networkHost.removeEventListener("getPlayers", this._getPlayersEvent);
        }
        else {
            const networkClient = this.game.networkInstance as NetworkClient;
            networkClient.removeEventListener("setPlayers", this._setPlayersEvent);
            networkClient.removeEventListener("host-disconnected", this._hostDisconnectedEvent);
            networkClient.removeEventListener("player-joined", this._addPlayer);
            networkClient.removeEventListener("player-left", this._removePlayer);
        }

        super.destroy();
    }

    private _createCave(): void {
        const caveContainer = this.loadedAssets["lobbyScene"];
        caveContainer.addAllToScene();

        // fire particles
        const firePosition: B.Vector3 = new B.Vector3(-.5, 2, 7);

        B.ParticleHelper.CreateAsync("fire", this.babylonScene).then((set: B.ParticleSystemSet): void => {
            set.systems.forEach((s: B.IParticleSystem): void => {
                s.emitter = firePosition;
            });
            set.start();
        });

        this.game.soundManager.playSound("fireplace");
    }

    private _handleHost(): void {
        const networkHost = this.game.networkInstance as NetworkHost;
        this._roomId = networkHost.peer.id.slice(0, 6);

        // add host player
        this._createPlayer(networkHost.players[0], this._playersTransform[0]);

        networkHost.addEventListener("player-joined", this._addPlayerEvent);
        networkHost.addEventListener("player-left", this._removePlayerEvent);

        // send the player list to the client
        networkHost.addEventListener("getPlayers", this._getPlayersEvent);
    }

    private _handleClient(): void {
        const networkClient = this.game.networkInstance as NetworkClient;
        this._roomId = networkClient.hostId.slice(0, 6);

        // when the player first joins, get the player list from the host
        networkClient.addEventListener("setPlayers", this._setPlayersEvent);
        // if the host disconnects, go back to the menu
        networkClient.addEventListener("host-disconnected", this._hostDisconnectedEvent);
        // if a player joins, update the player list
        networkClient.addEventListener("player-joined", this._addPlayerEvent);
        // if a player leaves, update the player list
        networkClient.addEventListener("player-left", this._removePlayerEvent);

        // get the player list from the host
        networkClient.sendToHost("getPlayers", this.game.networkInstance.peer.id);
    }

    private _onHostDisconnected(): void {
        this.game.displayMessage("Lost connection to the host", "error");
        this.game.fadeIn(this.sceneManager.changeScene.bind(this.sceneManager, "menu"));
    }

    private _setPlayersClientRpc(players: PlayerData[]): void {
        const networkClient = this.game.networkInstance as NetworkClient;
        networkClient.players = players;
        networkClient.players.forEach((player: PlayerData, index: number): void => {
            this._createPlayer(player, this._playersTransform[index]);
        });
        this.eventManager.notify("update-number", this._players.size);
    }

    private _getPlayersHostRpc(peerId: string): void {
        const networkHost = this.game.networkInstance as NetworkHost;
        // tell to the player to update his player list
        networkHost.sendToClient("setPlayers", peerId, networkHost.players);
        networkHost.synchronizeClientTick();
    }

    private _addPlayer(player: PlayerData): void {
        if (this._players.get(player.id)) return;

        this.game.displayMessage(`${player.name} joined the lobby`, "info");

        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("player-joined", player);
        }

        this._createPlayer(player, this._playersTransform[this._players.size]);
        this.eventManager.notify("update-number", this._players.size);
    }

    private _removePlayer(playerId: string): void {
        const player: {entity: Entity, text: GUI.TextBlock} | undefined = this._players.get(playerId);
        if (!player) return;

        this.game.displayMessage(`${player.text.text} left the lobby`, "info");

        if (this.game.networkInstance.isHost) {
            const networkHost = this.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients("player-left", playerId);
        }

        this.entityManager.removeEntity(player.entity);
        this._gui.removeControl(player.text);
        this._players.delete(playerId);
        this.eventManager.notify("update-number", this._players.size);
    }

    private _createPlayer(playerData: PlayerData, transform: {position: B.Vector3, rotation: B.Vector3}): void {
        let sittingAnimationIndex: string = "";
        let playerContainer: B.AssetContainer;
        if (playerData.skinOptions.modelIndex === 0) {
            playerContainer = this.loadedAssets["caveman"];
        }
        else {
            playerContainer = this.loadedAssets["cavewoman"];
            sittingAnimationIndex = "1";
        }
        const playerEntity = new Entity("player");

        const entries: B.InstantiatedEntries = playerContainer.instantiateModelsToScene((sourceName: string): string => sourceName + playerEntity.id, true, {doNotInstantiate: true});
        const player = entries.rootNodes[0] as B.Mesh;
        player.position = transform.position;
        player.rotation = transform.rotation;

        playerEntity.addComponent(new MeshComponent(playerEntity, this, {mesh: player}));

        // apply colors
        Utils.applyColorsToMesh(player, playerData.skinOptions);

        // animations
        const animations: {[key: string]: B.AnimationGroup} = {};
        animations["Sitting"] = Utils.getAnimationGroupByName(`Siting${sittingAnimationIndex}${playerEntity.id}`, entries.animationGroups);
        const networkAnimationComponent = new NetworkAnimationComponent(playerEntity, this, {animations});
        playerEntity.addComponent(networkAnimationComponent);
        networkAnimationComponent.startAnimation("Sitting", {loop: true});

        // player name text
        const playerNameText = new GUI.TextBlock();
        playerNameText.text = playerData.name;
        playerNameText.color = "#ff0000";
        playerNameText.fontSize = 2.3 * this.game.viewportHeight;
        playerNameText.outlineColor = "black";
        playerNameText.outlineWidth = 0.6 * this.game.viewportHeight;
        this._gui.addControl(playerNameText);
        playerNameText.linkWithMesh(player);
        playerNameText.linkOffsetY = -17 * this.game.viewportHeight;

        this.entityManager.addEntity(playerEntity);

        this._players.set(playerData.id, {entity: playerEntity, text: playerNameText});
    }
}