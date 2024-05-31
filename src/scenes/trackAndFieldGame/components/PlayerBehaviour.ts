import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {PlayerData} from "../../../network/types";
import {GameController} from "./GameController";
import {InputStates} from "../../../core/types";
import {NetworkHost} from "../../../network/NetworkHost";
import {CameraMovement} from "./CameraMovement";
import {Utils} from "../../../utils/Utils";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // components
    private _mesh!: B.Mesh;
    private _physicsAggregate!: B.PhysicsAggregate;
    private _networkAnimationComponent!: NetworkAnimationComponent;
    private _gameController!: GameController;

    // properties
    private _isGameStarted: boolean = false;
    private readonly _isOwner!: boolean; // is the player the owner of the entity
    private _gui!: GUI.AdvancedDynamicTexture;
    private _canPressLeft: boolean = true;
    private _canPressRight: boolean = true;
    private _isLeftTurn: boolean = false;
    public hasFinished: boolean = false;

    // movement
    private _speed: number = 155 / 1000;
    private _maxSpeed: number = 14000 / 1000;
    public velocity: B.Vector3 = B.Vector3.Zero();
    private _slowDownSpeed: number = 25 / 1000;

    // inputs
    public readonly playerId!: string;
    public readonly playerData!: PlayerData;

    // event listeners
    private _updateSpeedEvent = this._updateSpeedUI.bind(this);
    private _onKillPlayerEvent = this._killClientRpc.bind(this);
    private _onStopPlayerEvent = this._stopPlayerClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene, props: { playerData: PlayerData }) {
        this.entity = entity;
        this.scene = scene;
        this.playerId = props.playerData.id;
        this.playerData = props.playerData;
        this._isOwner = this.scene.game.networkInstance.playerId === this.playerId;
    }

    public onStart(): void {
        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = meshComponent.mesh;

        this._networkAnimationComponent = this.entity.getComponent("NetworkAnimation") as NetworkAnimationComponent;
        this._networkAnimationComponent.startAnimation("Idle");

        const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        this._physicsAggregate = rigidBodyComponent.physicsAggregate;

        this.showPlayerNameUI(2.1 * this.scene.game.viewportHeight, 0.5 * this.scene.game.viewportHeight, -10 * this.scene.game.viewportHeight);

        // subscribe to game events
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));

        const gameManagerEntity: Entity = this.scene.entityManager.getFirstEntityByTag("gameManager")!;
        this._gameController = gameManagerEntity.getComponent("GameController") as GameController;

        // CLIENT
        if (!this.scene.game.networkInstance.isHost) {
            this.scene.game.networkInstance.addEventListener(`onKillPlayer${this.entity.id}`, this._onKillPlayerEvent);
            this.scene.game.networkInstance.addEventListener(`onStopPlayer${this.entity.id}`, this._onStopPlayerEvent);

            if (this._isOwner) {
                this.scene.game.networkInstance.addEventListener(`setSpeed${this.entity.id}`, this._updateSpeedEvent);
            }
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this._isGameStarted || this.hasFinished) return;

        // HOST
        if (!this.scene.game.networkInstance.isHost) return;

        if (this._isOwner) {
            const inputStates: InputStates = this.scene.game.inputManager.inputStates;
            this._checkInputs(inputStates);
        }
        else {
            // handle client inputs
            const inputs: InputStates[] = this.scene.game.networkInputManager.getPlayerInput(this.playerId);
            for (let i: number = 0; i < inputs.length; i++) {
                const inputStates: InputStates = inputs[i];
                this._checkInputs(inputStates);
            }
        }

        this._applyVelocity();
        this._animate();
        this._updateSpeedUI(this.velocity.x);
    }

    public onDestroy(): void {
        this._hidePlayerNameUI();

        // CLIENT
        if (!this.scene.game.networkInstance.isHost) {
            this.scene.game.networkInstance.removeEventListener(`onKillPlayer${this.entity.id}`, this._onKillPlayerEvent);
            this.scene.game.networkInstance.removeEventListener(`onStopPlayer${this.entity.id}`, this._onStopPlayerEvent);
            if (this._isOwner) {
                this.scene.game.networkInstance.removeEventListener(`setSpeed${this.entity.id}`, this._updateSpeedEvent);
            }
        }
    }

    private _animate(): void {
        if (this.velocity.x > 0) {
            this._networkAnimationComponent.startAnimation("Running", {loop: true, transitionSpeed: .12, speedRatio: 1.15});
        }
        else {
            this._networkAnimationComponent.startAnimation("Idle", {loop: true});
        }
    }

    private _applyVelocity(): void {
        // apply slow down speed
        if (this.velocity.x > 0) {
            this.velocity.x -= this._slowDownSpeed;
        }
        else {
            this.velocity.x = 0;
        }

        this._physicsAggregate.body.setLinearVelocity(this.velocity);
    }

    private _checkInputs(inputs: InputStates): void {
        if (inputs.buttons["left"] && this._canPressLeft && this._isLeftTurn) {
            this._isLeftTurn = false;
            this.velocity.x += this._speed;
        }
        else if (inputs.buttons["right"] && this._canPressRight && !this._isLeftTurn) {
            this._isLeftTurn = true;
            this.velocity.x += this._speed;
        }

        this._canPressLeft = !inputs.buttons["left"];
        this._canPressRight = !inputs.buttons["right"];
    }

    public showPlayerNameUI(fontSize: number, outline: number, offsetY: number): void {
        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene.babylonScene);

        // player name text
        const playerNameText = new GUI.TextBlock();
        playerNameText.text = this.playerData.name;
        playerNameText.color = "#ff0000";
        playerNameText.fontSize = fontSize;
        playerNameText.outlineColor = "black";
        playerNameText.outlineWidth = outline;
        this._gui.addControl(playerNameText);
        playerNameText.linkWithMesh(this._mesh);
        playerNameText.linkOffsetY = offsetY;
    }

    private _hidePlayerNameUI(): void {
        this._gui.dispose();
    }

    private _onGameStarted(): void {
        this._isGameStarted = true;
    }

    private _onGameFinished(): void {
        this._hidePlayerNameUI();
    }

    public kill(): void {
        this.hasFinished = true;
        this.velocity.x = 0;
        this._gameController.setSpeed(0);
        this._hidePlayerNameUI();
        this._networkAnimationComponent.startAnimation("Death", {from: 60});
        this._changePlayerView();

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients(`onKillPlayer${this.entity.id}`);
    }

    public stopPlayer(): void {
        this.hasFinished = true;
        this._gameController.setSpeed(0);
        this._networkAnimationComponent.startAnimation("Idle", {loop: true});
        this.velocity.x = 0;
        this._physicsAggregate.body.setLinearVelocity(this.velocity);
        this._hidePlayerNameUI();
        this._changePlayerView();

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients(`onStopPlayer${this.entity.id}`);
    }

    private _killClientRpc(): void {
        this.hasFinished = true;
        this._hidePlayerNameUI();
        if (this._isOwner) this._gameController.setSpeed(0);
        this._changePlayerView();
    }

    private _stopPlayerClientRpc(): void {
        this.hasFinished = true;
        if (this._isOwner) this._gameController.setSpeed(0);
        this._hidePlayerNameUI();
        this._changePlayerView();
    }

    private _updateSpeedUI(velocityX: number): void {
        // OWNER
        if (this._isOwner && !this.hasFinished) {
            this._gameController.setSpeed(velocityX * 100 / this._maxSpeed);
        }

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients(`setSpeed${this.entity.id}`, velocityX);
        }
    }

    private _changePlayerView(): void {
        const playerCamera: Entity = this.scene.entityManager.getFirstEntityByTag("playerCamera")!;
        const cameraMovementComponent = playerCamera.getComponent("CameraMovement") as CameraMovement;
        setTimeout((): void => {
            cameraMovementComponent.changePlayerView();
        }, 3000);
    }

    public playRandomReactionAnimation(isWin: boolean): void {
        const randomDelay: number = Utils.randomInt(0, 1000);
        setTimeout((): void => {
            if (isWin) {
                const random: number = Utils.randomInt(0, 3);
                if (random !== 3) this._networkAnimationComponent.startAnimation("Celebration", {loop: true, smoothTransition: true});
                else this._networkAnimationComponent.startAnimation("TakeTheL", {loop: true, smoothTransition: true});
            }
            else {
                this._networkAnimationComponent.startAnimation("Defeat", {loop: true, smoothTransition: true});
            }
        }, randomDelay);
    }
}