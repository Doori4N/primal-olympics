import {Entity} from "../../../../core/Entity";
import {Scene} from "../../../../core/Scene";
import * as B from "@babylonjs/core";
import {InputStates} from "../../../../core/types";
import {BallBehaviour} from "../BallBehaviour";
import {MeshComponent} from "../../../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../../../core/components/RigidBodyComponent";
import {NetworkPredictionComponent} from "../../../../network/components/NetworkPredictionComponent";
import {AbstractPlayerBehaviour} from "./AbstractPlayerBehaviour";
import {Utils} from "../../../../utils/Utils";

export class PlayerBehaviour extends AbstractPlayerBehaviour {
    public name: string = "PlayerBehaviour";

    // components properties
    private _networkPredictionComponent!: NetworkPredictionComponent<InputStates>;
    private _isOwner!: boolean; // is the player the owner of the entity
    private _playerCollisionObserver!: B.Observer<B.IPhysicsCollisionEvent>;

    // inputs
    public readonly playerId!: string;

    constructor(entity: Entity, scene: Scene, props: {playerId: string, teamIndex: number}) {
        super(entity, scene, props.teamIndex);
        this.playerId = props.playerId;
    }

    public onStart(): void {
        super.onStart();

        const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        if (this.scene.game.networkInstance.isHost) {
            this._playerCollisionObserver = rigidBodyComponent.collisionObservable.add(this._onCollision.bind(this));
        }

        this._networkPredictionComponent = this.entity.getComponent("NetworkPrediction") as NetworkPredictionComponent<InputStates>;
        this._networkPredictionComponent.onApplyInput.add(this._applyPredictedInput.bind(this));

        this._isOwner = this.scene.game.networkInstance.playerId === this.playerId;
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this._isGameStarted || this._isGameFinished || this._isGamePaused) return;
        if (this.scene.game.networkInstance.isHost) this._handleServerUpdate();
        else this._handleClientUpdate();
    }

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) this._playerCollisionObserver.remove();
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

    /**
     * Re-apply the predicted input and simulate physics
     */
    private _applyPredictedInput(inputs: InputStates): void {
        // don't apply prediction the input if the player is frozen
        if (this._isFrozen) return;
        this._movePlayer(inputs);
        this.scene.simulate([this._physicsAggregate.body]);
    }

    private _processInputStates(inputStates: InputStates): void {
        if (this.isTackling) return;

        if (this._isFrozen) {
            this._velocity = B.Vector3.Zero();
            this._move();
            return;
        }

        this._movePlayer(inputStates);

        this._animate(inputStates);

        if (!this.scene.game.networkInstance.isHost) return;

        // HOST
        if (this.ballEntity) {
            if (inputStates.buttons["jump"]) {
                this._shoot(this.ballEntity);
            }
            else if (inputStates.buttons["sprint"]) {
                this._pass(this.ballEntity);
            }
        }
        else {
            if (inputStates.buttons["jump"] && this._canTackle) {
                this._tackle();
            }
        }
    }

    /**
     * Set the linear velocity of the player according to his inputs
     */
    private _movePlayer(inputs: InputStates): void {
        this._velocity = new B.Vector3(inputs.direction.x, 0, inputs.direction.y).normalize();
        this._velocity.scaleInPlace(this._speed);
        this._move();
    }

    private _animate(inputStates: InputStates): void {
        if (this._networkAnimationComponent.isPlaying("Kicking") ||
            this._networkAnimationComponent.isPlaying("Tackling")) return;

        const isInputPressed: boolean = inputStates.direction.x !== 0 || inputStates.direction.y !== 0;
        if (isInputPressed) {
            this._networkAnimationComponent.startAnimation("Running", {loop: true, transitionSpeed: 0.12});
        }
        else {
            this._networkAnimationComponent.startAnimation("Idle", {loop: true});
        }
    }

    private _shoot(ballEntity: Entity): void {
        const ballBehaviourComponent = ballEntity.getComponent("BallBehaviour") as BallBehaviour;
        const direction: B.Vector3 = this._mesh.forward.clone();
        this._networkAnimationComponent.startAnimation("Kicking", {to: 75});
        this._networkAudioComponent.playSound("Kick", {offset: 0, duration: 1, volume: 0.5});
        this._freezePlayer(this._shootDuration);

        setTimeout((): void => {
            // if the player lost the ball, do nothing
            if (!this.ballEntity) return;

            ballBehaviourComponent.kickBall(direction, this._shootForce);
            this.ballEntity = null;
            // delay the tackle to avoid the player to tackle right after shooting
            this.blockTackle();
        }, this._shootDelay);
    }

    private _pass(ballEntity: Entity): void {
        const closestPlayer: B.Nullable<B.Mesh> = this._getClosestPlayerToPassTo();
        if (!closestPlayer) return;

        this._networkAnimationComponent.startAnimation("Kicking", {from: 27, to: 60, smoothTransition: true});
        this._networkAudioComponent.playSound("Kick", {offset: 0.3, duration: 1, volume: 0.5});
        this._freezePlayer(500);

        const direction: B.Vector3 = closestPlayer.position.subtract(this._mesh.position).normalize();
        const ballBehaviourComponent = ballEntity.getComponent("BallBehaviour") as BallBehaviour;
        ballBehaviourComponent.kickBall(direction, this._shootForce);

        this.ballEntity = null;

        // delay the tackle to avoid the player to tackle right after passing
        this.blockTackle();
    }

    private _getClosestPlayerToPassTo(): B.Nullable<B.Mesh> {
        const players: Entity[] = this.scene.entityManager.getEntitiesByTag("player");
        let minDistance: number = 100;
        let closestPlayer: B.Nullable<B.Mesh> = null;

        players.forEach((playerEntity: Entity): void => {
            const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;

            // if this is the same player or the player is not in the same team, skip
            if (playerBehaviourComponent.playerId === this.playerId || playerBehaviourComponent.teamIndex !== this.teamIndex) return;

            const playerMeshComponent = playerEntity.getComponent("Mesh") as MeshComponent;
            const targetPlayerPosition: B.Vector3 = playerMeshComponent.mesh.position;
            const passDirection: B.Vector3 = this._mesh.forward.clone().normalize();
            const distance: number = this._minDistancePointLine(this._mesh.position, passDirection, targetPlayerPosition);

            if (distance < minDistance) {
                minDistance = distance;
                closestPlayer = playerMeshComponent.mesh;
            }
        });

        const aiPlayers: Entity[] = this.scene.entityManager.getEntitiesByTag("aiPlayer");
        aiPlayers.forEach((aiPlayerEntity: Entity): void => {
            const aiPlayerBehaviourComponent = aiPlayerEntity.getComponent("AIPlayerBehaviour") as AbstractPlayerBehaviour;

            // if the player is not in the same team, skip
            if (aiPlayerBehaviourComponent.teamIndex !== this.teamIndex) return;

            const aiPlayerMeshComponent = aiPlayerEntity.getComponent("Mesh") as MeshComponent;
            const targetPlayerPosition: B.Vector3 = aiPlayerMeshComponent.mesh.position;
            const passDirection: B.Vector3 = this._mesh.forward.clone().normalize();
            const distance: number = this._minDistancePointLine(this._mesh.position, passDirection, targetPlayerPosition);

            if (distance < minDistance) {
                minDistance = distance;
                closestPlayer = aiPlayerMeshComponent.mesh;
            }
        });

        return closestPlayer;
    }

    private _onCollision(event: B.IPhysicsCollisionEvent): void {
        if (event.type !== B.PhysicsEventType.COLLISION_CONTINUED) return;

        const collidedAgainst: B.TransformNode = event.collidedAgainst.transformNode;

        if (collidedAgainst.metadata?.tag === "player" || collidedAgainst.metadata?.tag === "aiPlayer") {
            this._handlePlayerCollision(collidedAgainst);
        }
        else if (collidedAgainst.metadata?.tag === "ball") {
            this._handleBallCollision(collidedAgainst);
        }
    }

    private _handleBallCollision(ballTransformNode: B.TransformNode): void {
        if (this._isFrozen) return;

        const ballEntity: Entity = this.scene.entityManager.getEntityById(ballTransformNode.metadata.id);
        const ballBehaviourComponent = ballEntity.getComponent("BallBehaviour") as BallBehaviour;

        const previousOwner: B.Nullable<{playerId?: string, entityId: string, mesh: B.Mesh, teamIndex: number}> = ballBehaviourComponent.getOwner();
        if (previousOwner) {
            // if the player already has the ball or is not tackling, do nothing
            if (previousOwner.playerId === this.playerId || !this.isTackling) return;

            // else tell the previous owner that he lost the ball
            const previousOwnerEntity: Entity = this.scene.entityManager.getEntityById(previousOwner.entityId);
            let previousOwnerBehaviour: AbstractPlayerBehaviour;
            if (previousOwner.playerId) previousOwnerBehaviour = previousOwnerEntity.getComponent("PlayerBehaviour") as AbstractPlayerBehaviour
            else previousOwnerBehaviour = previousOwnerEntity.getComponent("AIPlayerBehaviour") as AbstractPlayerBehaviour;
            previousOwnerBehaviour.ballEntity = null;
            previousOwnerBehaviour.stun();
        }

        // give the ball to the player
        ballBehaviourComponent.setOwner({
            mesh: this._mesh,
            playerId: this.playerId,
            teamIndex: this.teamIndex,
            entityId: this.entity.id
        });
        this.ballEntity = ballEntity;
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
}