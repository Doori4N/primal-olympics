import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import {InputStates} from "../../../core/types";
import {NetworkHost} from "../../../network/NetworkHost";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {NetworkPredictionComponent} from "../../../network/components/NetworkPredictionComponent";
import {GameScores} from "./GameScores";
import {PlayerData} from "../../../network/types";
import {Utils} from "../../../utils/Utils";
import {CameraMovement} from "./CameraMovement";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // components
    private _mesh!: B.Mesh;
    private _physicsAggregate!: B.PhysicsAggregate;
    private _networkAnimationComponent!: NetworkAnimationComponent;
    private _networkPredictionComponent!: NetworkPredictionComponent<InputStates>;

    // properties
    private _isGameStarted: boolean = false;
    private _isGameFinished: boolean = false;
    private readonly _isOwner!: boolean; // is the player the owner of the entity
    private _observer!: B.Observer<B.IBasePhysicsCollisionEvent>;
    private _playerCollisionEndedObserver!: B.Observer<B.IBasePhysicsCollisionEvent>;
    private _playerCollisionObserver!: B.Observer<B.IPhysicsCollisionEvent>;
    private _gui!: GUI.AdvancedDynamicTexture;
    public isDead: boolean = false;

    // movement
    private _speed: number = 5;
    public velocity: B.Vector3 = B.Vector3.Zero();
    private _isFalling: boolean = false;
    private _isFrozen: boolean = false;

    // push
    private _collisionBoxLifeSpan: number = 200;
    private _pushCooldown: number = 2000;
    private _canPush: boolean = true;
    private _pushDelay: number = 300;
    private _pushDuration: number = 600;
    private _pushForce: number = 14;

    // inputs
    public readonly playerId!: string;
    public readonly _playerData!: PlayerData;

    // event listeners
    private _onPushEvent = this._pushPlayerClientRpc.bind(this);
    private _onKillPlayerEvent = this._onKillPlayerClientRpc.bind(this);
    private _onBurnPlayerEvent = this._onBurnPlayerClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene, props: {playerData: PlayerData}) {
        this.entity = entity;
        this.scene = scene;
        this.playerId = props.playerData.id;
        this._playerData = props.playerData;
        this._isOwner = this.scene.game.networkInstance.playerId === this.playerId;
    }

    public onStart(): void {
        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = meshComponent.mesh;

        this._networkPredictionComponent = this.entity.getComponent("NetworkPrediction") as NetworkPredictionComponent<InputStates>;
        this._networkPredictionComponent.onApplyInput.add(this._applyPredictedInput.bind(this));

        this._networkAnimationComponent = this.entity.getComponent("NetworkAnimation") as NetworkAnimationComponent;
        this._networkAnimationComponent.startAnimation("Idle");

        const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        this._physicsAggregate = rigidBodyComponent.physicsAggregate;

        this.showPlayerNameUI(15, 5, -60);

        // subscribe to game events
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.physicsPlugin!.onTriggerCollisionObservable;
            this._observer = observable.add(this._onTriggerCollision.bind(this));
            this._playerCollisionEndedObserver = this._physicsAggregate.body.getCollisionEndedObservable().add(this._onCollision.bind(this));
            this._playerCollisionObserver = this._physicsAggregate.body.getCollisionObservable().add(this._onCollision.bind(this));
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.addEventListener(`onPush${this.entity.id}`, this._onPushEvent);
            this.scene.game.networkInstance.addEventListener(`onKillPlayer${this.entity.id}`, this._onKillPlayerEvent);
            this.scene.game.networkInstance.addEventListener(`onBurnPlayer${this.entity.id}`, this._onBurnPlayerEvent);
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this._isGameStarted || this._isGameFinished) return;
        if (this.scene.game.networkInstance.isHost) this._handleServerUpdate();
        else this._handleClientUpdate();
    }

    public onDestroy(): void {
        this._hidePlayerNameUI();

        // HOST
        if (this.scene.game.networkInstance.isHost) {
            this._observer.remove();
            this._playerCollisionEndedObserver.remove();
            this._playerCollisionObserver.remove();
        }
        // CLIENT
        else {
            this.scene.game.networkInstance.removeEventListener(`onPush${this.entity.id}`, this._onPushEvent);
            this.scene.game.networkInstance.removeEventListener(`onKillPlayer${this.entity.id}`, this._onKillPlayerEvent);
            this.scene.game.networkInstance.removeEventListener(`onBurnPlayer${this.entity.id}`, this._onBurnPlayerEvent);
        }
    }

    public showPlayerNameUI(fontSize: number, outline: number, offsetY: number): void {
        this._gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene.babylonScene);

        // player name text
        const playerNameText = new GUI.TextBlock();
        playerNameText.text = this._playerData.name;
        playerNameText.color = "#00dd00";
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

    private _animate(inputStates: InputStates): void {
        const isInputPressed: boolean = inputStates.direction.x !== 0 || inputStates.direction.y !== 0;
        if (isInputPressed) {
            this._networkAnimationComponent.startAnimation("Running", {loop: true, transitionSpeed: 0.12});
        }
        else {
            this._networkAnimationComponent.startAnimation("Idle", {loop: true});
        }
    }

    private _onGameStarted(): void {
        this._isGameStarted = true;
    }

    private _onGameFinished(): void {
        this.velocity = B.Vector3.Zero();
        this._physicsAggregate.body.setLinearVelocity(this.velocity);
        this._networkAnimationComponent.startAnimation("Idle", {loop: true});
        this._isGameFinished = true;
        if (!this.isDead) {
            this._hidePlayerNameUI();
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

    private _handleServerUpdate(): void {
        // if owner, compute the movement and send update to clients
        if (this._isOwner) {
            const inputStates: InputStates = this.scene.game.inputManager.inputStates;
            this._processInputStates(inputStates);
            this._networkPredictionComponent.sendTransformUpdate(inputStates.tick, this.velocity.clone());
        }
        // compute client movements and send updates to clients
        else {
            const inputs: InputStates[] = this.scene.game.networkInputManager.getPlayerInput(this.playerId);
            for (let i: number = 0; i < inputs.length; i++) {
                const inputStates: InputStates = inputs[i];
                this._processInputStates(inputStates);
                this._networkPredictionComponent.sendTransformUpdate(inputStates.tick, this.velocity.clone());
                // don't simulate the last input because it will be simulated automatically in this frame
                if (i < inputs.length - 1) {
                    this.scene.simulate([this._physicsAggregate.body]);
                }
            }
        }
    }

    private _processInputStates(inputStates: InputStates): void {
        if (this.isDead) return;

        if (this._isFalling) {
            this.velocity.y = -5;
            this._physicsAggregate.body.setLinearVelocity(this.velocity);
            this._networkAnimationComponent.startAnimation("Jump", {loop: true, from: 35, to: 35});
            return;
        }

        if (this._isFrozen) return;

        this._movePlayer(inputStates);

        if (!this.scene.game.networkInstance.isHost) return;

        // HOST
        this._animate(inputStates);
        this._checkPush(inputStates);
    }

    /**
     * Re-apply the predicted input and simulate physics
     */
    private _applyPredictedInput(inputs: InputStates): void {
        if (this._isFrozen || this._isFalling || this.isDead) return;
        this._movePlayer(inputs);
        this.scene.simulate([this._physicsAggregate.body]);
    }

    /**
     * Set the linear velocity of the player according to his inputs
     */
    private _movePlayer(inputs: InputStates): void {
        this.velocity = new B.Vector3(inputs.direction.x, 0, inputs.direction.y).normalize();
        this.velocity.scaleInPlace(this._speed);

        this._physicsAggregate.body.setLinearVelocity(this.velocity);

        // rotate mesh
        if (!this.velocity.equals(B.Vector3.Zero())) {
            const rotationY: number = Math.atan2(this.velocity.z, -this.velocity.x) - Math.PI / 2;
            this._mesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, rotationY, 0);
        }
    }

    /**
     * Freeze the player for a certain amount of time
     */
    private _freezePlayer(timestamp: number): void {
        this._isFrozen = true;
        this.velocity = B.Vector3.Zero();
        this._physicsAggregate.body.setLinearVelocity(this.velocity);

        setTimeout((): void => {
            this._isFrozen = false;
        }, timestamp);
    }

    /**
     * Check if the player can push other players and create a collision box
     */
    private _checkPush(inputStates: InputStates): void {
        if (!inputStates.buttons["jump"] || !this._canPush) return;

        this._networkAnimationComponent.startAnimation("Push", {from: 40, to: 90});
        this._freezePlayer(500);

        setTimeout((): void => {
            if (!this._canPush) return;
            this._canPush = false;

            this._createCollisionBox();

            // reset pushing ability after cooldown
            setTimeout((): void => {
                this._canPush = true;
            }, this._pushCooldown);
        }, this._pushDelay);
    }

    /**
     * Create a collision box to push other players
     */
    private _createCollisionBox(): void {
        const collisionBoxEntity: Entity = new Entity("collisionBox");

        // collisionBox mesh
        const collisionBox: B.Mesh = B.MeshBuilder.CreateBox("collisionBox", {width: 2.5, height: 1, depth: 1}, this.scene.babylonScene);
        collisionBox.isVisible = false;

        const direction: B.Vector3 = new B.Vector3(
            Math.round(this._mesh.forward.x * 100) / 100,
            0,
            Math.round(this._mesh.forward.z * 100) / 100
        );
        collisionBox.position = this._mesh.position.add(direction.scale(1.2));
        collisionBox.rotation.y = Math.atan2(direction.z, -direction.x);

        collisionBox.metadata = {
            tag: "collisionBox",
            id: collisionBoxEntity.id,
            ownerId: this.entity.id,
            direction: direction
        };

        collisionBoxEntity.addComponent(new MeshComponent(collisionBoxEntity, this.scene, {mesh: collisionBox}));
        collisionBoxEntity.addComponent(new RigidBodyComponent(collisionBoxEntity, this.scene, {
            physicsShape: B.PhysicsImpostor.BoxImpostor,
            physicsProps: {mass: 0},
            isTrigger: true
        }));
        this.scene.entityManager.addEntity(collisionBoxEntity);

        setTimeout((): void => {
            this.scene.entityManager.removeEntity(collisionBoxEntity);
        }, this._collisionBoxLifeSpan);
    }

    /**
     * Push the player in the direction of the impulse
     */
    public pushPlayer(impulseDirection: B.Vector3): void {
        this._isFrozen = true;

        this._networkAnimationComponent.startAnimation("Push_Reaction");

        this.velocity = impulseDirection.scale(this._pushForce);
        this._physicsAggregate.body.setLinearVelocity(this.velocity);

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients(`onPush${this.entity.id}`);

        setTimeout((): void => {
            this._isFrozen = false;
        }, this._pushDuration);
    }

    private _pushPlayerClientRpc(): void {
        this._isFrozen = true;

        setTimeout((): void => {
            this._isFrozen = false;
        }, this._pushDuration);
    }

    private _onTriggerCollision(collisionEvent: B.IBasePhysicsCollisionEvent): void {
        const collider: B.TransformNode = collisionEvent.collider.transformNode;
        const collidedAgainst: B.TransformNode = collisionEvent.collidedAgainst.transformNode;

        if (collisionEvent.type !== "TRIGGER_ENTERED") return;

        // player collision
        else if (collider.metadata?.tag === "player" && collidedAgainst.metadata?.tag === "collisionBox") {
            // don't push the player if he is the owner of the collision box
            if (collidedAgainst.metadata?.ownerId === collider.metadata?.id) return;

            const impulseDirection: B.Vector3 = collisionEvent.collidedAgainst.transformNode.metadata?.direction;

            const playerEntity: Entity = this.scene.entityManager.getEntityById(collisionEvent.collider.transformNode.metadata?.id);
            const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
            playerBehaviourComponent.pushPlayer(impulseDirection);
        }
    }

    private _onCollision(event: B.IBasePhysicsCollisionEvent): void {
        const collidedAgainst: B.TransformNode = event.collidedAgainst.transformNode;

        if (collidedAgainst.metadata?.tag === "ground" && event.type === B.PhysicsEventType.COLLISION_FINISHED) {
            this._isFalling = true;
        }
        else if (collidedAgainst.metadata?.tag === "ground" && event.type === B.PhysicsEventType.COLLISION_STARTED) {
            this._isFalling = false;
        }
        else if (collidedAgainst.metadata?.tag === "lavaGround") {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients(`onBurnPlayer${this.entity.id}`);

            this._burnPlayer();
            this._mesh.position.y = -10;
            this._hidePlayer();
            this._removeCollisionObservers();
            this._changePlayerView();

            // update player score
            const gameController: Entity | null = this.scene.entityManager.getFirstEntityByTag("gameManager");
            if (!gameController) throw new Error("Game controller not found");
            const gameScoresComponent = gameController.getComponent("GameScores") as GameScores;
            gameScoresComponent.setPlayerScore(this.entity);
        }
    }

    private _burnPlayer(): void {
        const deathPoint: B.Vector3 = this._mesh.position.clone();

        B.ParticleHelper.CreateAsync("fire", this.scene.babylonScene).then((set: B.ParticleSystemSet): void => {
            // attach the particle system to the player mesh
            set.systems.forEach((s: B.IParticleSystem): void => {
                s.emitter = deathPoint;
            });
            set.start();

            // dispose the particle system
            setTimeout((): void => {
                set.dispose();
            }, 3000);
        });

        this.scene.game.soundManager.playSound("lava-death", {sprite: "lava"});
    }

    public kill(): void {
        // move the player under the ground so other players can't see him
        setTimeout((): void => {
            if (this._isGameFinished) return;
            this._mesh.position.y = -10;
        }, 4000);

        this._hidePlayer();
        this._networkAnimationComponent.startAnimation("Death", {from: 60});
        this._changePlayerView();

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients(`onKillPlayer${this.entity.id}`);

        this._removeCollisionObservers();
    }

    private _hidePlayer(): void {
        this.isDead = true;
        this._hidePlayerNameUI();
        this.velocity = B.Vector3.Zero();
        this._physicsAggregate.body.setLinearVelocity(this.velocity);

        if (this.scene.game.networkInstance.isHost) {
            this._physicsAggregate.body.setMassProperties({mass: 0});
        }
    }

    private _removeCollisionObservers(): void {
        this._observer.remove();
        this._playerCollisionEndedObserver.remove();
        this._playerCollisionObserver.remove();
    }

    private _onKillPlayerClientRpc(): void {
        this._hidePlayer();
        this._changePlayerView();
    }

    private _onBurnPlayerClientRpc(): void {
        this._burnPlayer();
        this._hidePlayer();
        this._changePlayerView();
    }

    public playRandomReactionAnimation(isWin: boolean): void {
        const randomDelay: number = Utils.randomInt(0, 1000);
        setTimeout((): void => {
            if (isWin) {
                const random: number = Utils.randomInt(0, 1);
                if (random === 0) this._networkAnimationComponent.startAnimation("Celebration", {loop: true, smoothTransition: true});
                else this._networkAnimationComponent.startAnimation("TakeTheL", {loop: true, smoothTransition: true});
            }
            else {
                this._networkAnimationComponent.startAnimation("Defeat", {loop: true, smoothTransition: true});
            }
        }, randomDelay);
    }

    private _changePlayerView(): void {
        const playerCamera: Entity = this.scene.entityManager.getFirstEntityByTag("playerCamera")!;
        const cameraMovementComponent = playerCamera.getComponent("CameraMovement") as CameraMovement;
        setTimeout((): void => {
            cameraMovementComponent.changePlayerView();
        }, 3000);
    }
}