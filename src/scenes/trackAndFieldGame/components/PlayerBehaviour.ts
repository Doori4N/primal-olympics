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
    private _isGameFinished: boolean = false;
    private readonly _isOwner!: boolean; // is the player the owner of the entity
    private _gui!: GUI.AdvancedDynamicTexture;
    private _canPressLeft: boolean = true;
    private _canPressRight: boolean = true;
    private _isLeftTurn: boolean = false;

    // movement
    private _speed: number = 70 / 1000;
    private _maxSpeed: number = 7000 / 1000;
    public velocity: B.Vector3 = B.Vector3.Zero();
    private _slowDownSpeed: number = 10 / 1000;

    // inputs
    public readonly playerId!: string;
    public readonly playerData!: PlayerData;

    // event listeners

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

        this._showPlayerNameUI();

        // subscribe to game events
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));

        const gameManagerEntity: Entity = this.scene.entityManager.getFirstEntityByTag("gameManager")!;
        this._gameController = gameManagerEntity.getComponent("GameController") as GameController;
    }

    public onUpdate(): void {
    }

    public onFixedUpdate(): void {
        if (!this._isGameStarted || this._isGameFinished) return;

        this._checkInputs();
        this._applyVelocity();
        this._animate();
        this._gameController.setSpeed(this.velocity.x * 100 / this._maxSpeed);
    }

    public onDestroy(): void {
        this._hidePlayerNameUI();
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

    private _checkInputs(): void {
        const inputs = this.scene.game.inputManager.inputStates;

        if (inputs.buttons["left"] && this._canPressLeft && this._isLeftTurn) {
            this._isLeftTurn = false;
            this.velocity.x += this._speed;
        }
        else if (inputs.buttons["right"] && this._canPressRight && !this._isLeftTurn) {
            this._isLeftTurn = true;
            this.velocity.x += this._speed;
        }

        if (inputs.buttons["left"]) this._canPressLeft = false;
        else this._canPressLeft = true;

        if (inputs.buttons["right"]) this._canPressRight = false;
        else this._canPressRight = true;
    }

    private _showPlayerNameUI(): void {
        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene.babylonScene);

        // player name text
        const playerNameText = new GUI.TextBlock();
        playerNameText.text = this.playerData.name;
        playerNameText.color = "#ff0000";
        playerNameText.fontSize = 10;
        playerNameText.outlineColor = "black";
        playerNameText.outlineWidth = 3;
        this._gui.addControl(playerNameText);
        playerNameText.linkWithMesh(this._mesh);
        playerNameText.linkOffsetY = -60;
    }

    private _hidePlayerNameUI(): void {
        this._gui.dispose();
    }

    private _onGameStarted(): void {
        this._isGameStarted = true;
    }

    private _onGameFinished(): void {
        this._isGameFinished = true;
    }

    public kill(): void {
        this._onGameFinished();
        this.stopPlayer();
        this._gameController.setSpeed(0);
        // TODO: show death animation
    }

    public stopPlayer(): void {
        this._networkAnimationComponent.startAnimation("Idle", {loop: true});
        this.velocity.x = 0;
        this._physicsAggregate.body.setLinearVelocity(this.velocity);
    }
}