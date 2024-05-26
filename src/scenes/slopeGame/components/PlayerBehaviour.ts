import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";
import {NetworkPredictionComponent} from "../../../network/components/NetworkPredictionComponent";
import {InputStates} from "../../../core/types";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {NetworkHost} from "../../../network/NetworkHost";
import {PlayerData} from "../../../network/types";
import {CameraMovement} from "./CameraMovement";
import {Utils} from "../../../utils/Utils";


export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    public readonly playerId: string;
    public readonly playerData: PlayerData;
    private readonly _isOwner: boolean; // is the player the owner of the entity
    private _isGameStarted: boolean = false;
    private _networkAnimationComponent!: NetworkAnimationComponent;
    private _networkPredictionComponent!: NetworkPredictionComponent<InputStates>;
    private _physicsAggregate!: B.PhysicsAggregate;
    private _playerCollisionEndedObserver!: B.Observer<B.IBasePhysicsCollisionEvent>;
    private _playerCollisionObserver!: B.Observer<B.IPhysicsCollisionEvent>;
    private _mesh!: B.Mesh;
    private _gui!: GUI.AdvancedDynamicTexture;
    public hasFinished: boolean = false;
    private _isDead: boolean = false;

    // movement
    private _speed: number = 5;
    private _velocity: B.Vector3 = B.Vector3.Zero();
    private _isGrounded: boolean = false;
    private _isWalkingSoundPlaying: boolean = false;
    private _isBreathingSoundPlaying: boolean = false;


    // event listeners
    private _onKillPlayerEvent = this._onKillPlayerClientRpc.bind(this);
    private _onStopPlayerEvent = this._stopPlayerClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene, props: {playerData: PlayerData}) {
        this.entity = entity;
        this.scene = scene;
        this.playerId = props.playerData.id;
        this.playerData = props.playerData;
        this._isOwner = this.scene.game.networkInstance.playerId === this.playerId;
    }

    public onStart(): void {
        this._networkPredictionComponent = this.entity.getComponent("NetworkPrediction") as NetworkPredictionComponent<InputStates>;
        this._networkPredictionComponent.onApplyInput.add(this._applyPredictedInput.bind(this));

        this._networkAnimationComponent = this.entity.getComponent("NetworkAnimation") as NetworkAnimationComponent;
        this._networkAnimationComponent.startAnimation("Idle");

        const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        this._physicsAggregate = rigidBodyComponent.physicsAggregate;
        if (this.scene.game.networkInstance.isHost) {
            this._playerCollisionObserver = this._physicsAggregate.body.getCollisionObservable().add(this._onCollision.bind(this));
            this._playerCollisionEndedObserver = this._physicsAggregate.body.getCollisionEndedObservable().add(this._onCollision.bind(this));
        }

        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = meshComponent.mesh;

        this.showPlayerNameUI(18, 6, -180);

        // subscribe to game events
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));

        // CLIENT
        if (!this.scene.game.networkInstance.isHost) {
            this.scene.game.networkInstance.addEventListener(`onKillPlayer${this.entity.id}`, this._onKillPlayerEvent);
            this.scene.game.networkInstance.addEventListener(`onStopPlayer${this.entity.id}`, this._onStopPlayerEvent);
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (this.hasFinished && !this._isDead) {
            this._physicsAggregate.body.setLinearVelocity(B.Vector3.Zero());
            return;
        }

        if (!this._isGameStarted || this._isDead) return;
        if (this.scene.game.networkInstance.isHost) this._handleServerUpdate();
        else this._handleClientUpdate();
    }

    public onDestroy(): void {
        this._hidePlayerNameUI();

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            this._playerCollisionObserver.remove();
            this._playerCollisionEndedObserver.remove();
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.removeEventListener(`onKillPlayer${this.entity.id}`, this._onKillPlayerEvent);
            this.scene.game.networkInstance.removeEventListener(`onStopPlayer${this.entity.id}`, this._onStopPlayerEvent);
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

    private _handleServerUpdate(): void {
        if (this._isOwner) {
            const inputStates: InputStates = this.scene.game.inputManager.inputStates;
            this._processInputStates(inputStates);
            this._networkPredictionComponent.sendTransformUpdate(inputStates.tick, this._velocity.clone());
        }
        else {
            const inputs: InputStates[] = this.scene.game.networkInputManager.getPlayerInput(this.playerId);
            for (let i: number = 0; i < inputs.length; i++) {
                const inputStates: InputStates = inputs[i];
                this._processInputStates(inputStates);
                this._networkPredictionComponent.sendTransformUpdate(inputStates.tick, this._velocity.clone());
                // don't simulate the last input because it will be simulated automatically in this frame
                if (i < inputs.length - 1) {
                    this.scene.simulate([this._physicsAggregate.body]);
                }
            }
        }
    }

    private _handleClientUpdate(): void {
        const inputStates: InputStates = this.scene.game.inputManager.cloneInputStates(this.scene.game.inputManager.inputStates);

        // client prediction
        if (this._isOwner) {
            this._processInputStates(inputStates);
            this._networkPredictionComponent.predict(inputStates, inputStates.tick);
        }
    }

    private _processInputStates(inputStates: InputStates): void {
        if (!this._isGrounded) {
            this._velocity.y -= .9;
            this._physicsAggregate.body.setLinearVelocity(this._velocity);
            return;
        }

        this._movePlayer(inputStates);
        this._animate(inputStates);

        if (!this.scene.game.networkInstance.isHost) return;

        // HOST
        this._checkJump(inputStates);
    }

    private _checkJump(inputStates: InputStates): void {
        if (!inputStates.buttons["jump"] || !this._isGrounded) return;

        this._networkAnimationComponent.startAnimation("Jumping", {from: 29});
        this.scene.game.soundManager.playSound("jumpForest");
        this._velocity.y = 15;
        this._physicsAggregate.body.setLinearVelocity(this._velocity);
    }

    private _animate(inputStates: InputStates): void {
        const isInputPressed: boolean = inputStates.direction.x !== 0 || inputStates.direction.y !== 0;
    
        if (isInputPressed) {
            if (this._isBreathingSoundPlaying) {
                this.scene.game.soundManager.stopSound("respiration");
                this._isBreathingSoundPlaying = false;
            }
            if (!this._isWalkingSoundPlaying) {
                this.scene.game.soundManager.playSound("walkForest");
                this._isWalkingSoundPlaying = true;
            }
            this._networkAnimationComponent.startAnimation("Running", {loop: true, transitionSpeed: 0.12});
        } else {
            if (this._isWalkingSoundPlaying) {
                this.scene.game.soundManager.stopSound("walkForest");
                this._isWalkingSoundPlaying = false;
            }
            if (!this._isBreathingSoundPlaying) {
                this.scene.game.soundManager.playSound("respiration");
                this._isBreathingSoundPlaying = true;
            }
            this._networkAnimationComponent.startAnimation("Idle", {loop: true});
        }
    }
    

    /**
     * Set the linear velocity of the player according to his inputs
     */
    private _movePlayer(inputs: InputStates): void {
        this._velocity = new B.Vector3(inputs.direction.x, 0, inputs.direction.y).normalize();
        this._velocity.scaleInPlace(this._speed);
        this._physicsAggregate.body.setLinearVelocity(this._velocity);

        // rotate mesh
        if (!this._velocity.equals(B.Vector3.Zero())) {
            const rotationY: number = Math.atan2(this._velocity.z, -this._velocity.x) - Math.PI / 2;
            this._mesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, rotationY, 0);
        }
    }

    /**
     * Re-apply the predicted input and simulate physics
     */
    private _applyPredictedInput(inputs: InputStates): void {
        this._movePlayer(inputs);
        this.scene.simulate([this._physicsAggregate.body]);
    }

    private _onCollision(event: B.IBasePhysicsCollisionEvent): void {
        const collidedAgainst: B.TransformNode = event.collidedAgainst.transformNode;

        if (this.hasFinished) return;

        if (event.type === B.PhysicsEventType.COLLISION_CONTINUED) {
            // player is on the ground
            if (collidedAgainst.metadata.tag === "slope" || collidedAgainst.metadata.tag === "platform") {
                this._isGrounded = true;
            }
            else if (collidedAgainst.metadata.tag === "fallingObject") {
                this.scene.entityManager.removeEntity(this.scene.entityManager.getEntityById(collidedAgainst.metadata.id));
                this.kill();
                this.scene.eventManager.notify("onAddPlayerScore", this.playerData, this._mesh.position.z);
            }
        }
        else if (event.type === B.PhysicsEventType.COLLISION_FINISHED) {
            // player jumped off the ground
            if (collidedAgainst.metadata.tag === "slope" || collidedAgainst.metadata.tag === "platform") {
                this._isGrounded = false;
            }
        }
    }

    public kill(): void {
        this.hasFinished = true;
        this._isDead = true;
        this._hidePlayerNameUI();
        this._mesh.rotationQuaternion = new B.Quaternion(0, 0, 0, 0);
        this._networkAnimationComponent.startAnimation("Death", {from: 60});
        this._changePlayerView();

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients(`onKillPlayer${this.entity.id}`);

        this._removeCollisionObservers();
    }

    private _onKillPlayerClientRpc(): void {
        this.hasFinished = true;
        this._isDead = true;
        this._mesh.rotationQuaternion = new B.Quaternion(0, 0, 0, 0);
        this._hidePlayerNameUI();
        this._changePlayerView();
    }

    public stopPlayer(): void {
        this.hasFinished = true;
        this._mesh.rotationQuaternion = new B.Quaternion(0, 1, 0, 0);
        this._velocity = B.Vector3.Zero();
        this._networkAnimationComponent.startAnimation("Celebration", {loop: true});
        this._hidePlayerNameUI();
        this._changePlayerView();

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients(`onStopPlayer${this.entity.id}`);
    }

    private _stopPlayerClientRpc(): void {
        this.hasFinished = true;
        this._mesh.rotationQuaternion = new B.Quaternion(0, 1, 0, 0);
        this._velocity = B.Vector3.Zero();
        this._hidePlayerNameUI();
        this._changePlayerView();
    }

    private _removeCollisionObservers(): void {
        this._playerCollisionEndedObserver.remove();
        this._playerCollisionObserver.remove();
    }

    private _changePlayerView(): void {
        const playerCamera: Entity = this.scene.entityManager.getFirstEntityByTag("playerCamera")!;
        const cameraMovementComponent = playerCamera.getComponent("CameraMovement") as CameraMovement;
        setTimeout((): void => {
            cameraMovementComponent.changePlayerView();
        }, 3000);
    }

    private _onGameStarted(): void {
        this._isGameStarted = true;
    }

    private _onGameFinished(): void {
        setTimeout((): void => {
            this._physicsAggregate.body.setLinearVelocity(B.Vector3.Zero());
            this._mesh.position.z = -45;
            this._mesh.position.y = -13;
        }, 4000);
    }

    public playRandomReactionAnimation(isWin: boolean): void {
        const randomDelay: number = Utils.randomInt(0, 1000);
        setTimeout((): void => {
            if (isWin) {
                const random: number = Utils.randomInt(0, 3);
                if (random === 0) this._networkAnimationComponent.startAnimation("TakeTheL", {loop: true, smoothTransition: true});
                else this._networkAnimationComponent.startAnimation("Celebration", {loop: true, smoothTransition: true});
            }
            else {
                this._networkAnimationComponent.startAnimation("Defeat", {loop: true, smoothTransition: true});
            }
        }, randomDelay);
    }
}