import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";
import {PlayerData} from "../../../network/types";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {InputStates} from "../../../core/types";
import * as GUI from "@babylonjs/gui";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // components
    private _mesh!: B.Mesh;
    private _physicsAggregate!: B.PhysicsAggregate;
    private _networkAnimationComponent!: NetworkAnimationComponent;

    // properties
    private readonly _isOwner!: boolean; // is the player the owner of the entity
    private _gui!: GUI.AdvancedDynamicTexture;
    public hasFinished: boolean = false;
    private _isGameStarted: boolean = false;
    private _velocity: B.Vector3 = B.Vector3.Zero();
    private _maxSpeed: number = 7;
    private _accelerationX: number = 0.04;
    private _gravity: number = 0.5;
    private _jumpForce: number = 10;
    private _isGrounded: boolean = false;
    private _playerCollisionEndedObserver!: B.Observer<B.IBasePhysicsCollisionEvent>;
    private _playerCollisionObserver!: B.Observer<B.IPhysicsCollisionEvent>;

    // inputs
    public readonly playerId!: string;
    public readonly playerData!: PlayerData;

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
        if (this.scene.game.networkInstance.isHost) {
            this._playerCollisionObserver = this._physicsAggregate.body.getCollisionObservable().add(this._onCollision.bind(this));
            this._playerCollisionEndedObserver = this._physicsAggregate.body.getCollisionEndedObservable().add(this._onCollision.bind(this));
        }

        this.showPlayerNameUI(2.1 * this.scene.game.viewportHeight, 0.5 * this.scene.game.viewportHeight, -10 * this.scene.game.viewportHeight);

        // subscribe to game events
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
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
    }

    public onDestroy(): void {
        this._hidePlayerNameUI();

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            this._playerCollisionObserver.remove();
            this._playerCollisionEndedObserver.remove();
        }
    }

    private _animate(): void {
        if (!this._isGrounded) return;

        if (this._velocity.x > 0) {
            this._networkAnimationComponent.startAnimation("Running", {loop: true, transitionSpeed: .12, speedRatio: 1.15});
        }
        else {
            this._networkAnimationComponent.startAnimation("Idle", {loop: true});
        }
    }

    private _applyVelocity(): void {
        // apply acceleration
        if (this._velocity.x + this._accelerationX < this._maxSpeed) {
            this._velocity.x += this._accelerationX;
        }

        // apply gravity
        if (!this._isGrounded) {
            this._velocity.y -= this._gravity;
        }

        this._physicsAggregate.body.setLinearVelocity(this._velocity);
    }

    private _checkInputs(inputs: InputStates): void {
        if (inputs.buttons["jump"] && this._isGrounded) {
            this._velocity.y = this._jumpForce;
            this._networkAnimationComponent.startAnimation("Jumping", {from: 29, to: 39});
        }
    }

    private _onCollision(event: B.IBasePhysicsCollisionEvent): void {
        const collidedAgainst: B.TransformNode = event.collidedAgainst.transformNode;

        if (this.hasFinished) return;

        if (event.type === B.PhysicsEventType.COLLISION_CONTINUED) {
            // player is on the ground
            if (collidedAgainst.metadata.tag === "ground") {
                this._isGrounded = true;
            }
        }
        else if (event.type === B.PhysicsEventType.COLLISION_FINISHED) {
            // player jumped off the ground
            if (collidedAgainst.metadata.tag === "ground") {
                this._isGrounded = false;
            }
        }
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
}