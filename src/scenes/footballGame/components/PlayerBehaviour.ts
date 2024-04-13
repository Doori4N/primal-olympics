import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";
import {InputStates} from "../../../core/types";
import {BallBehaviour} from "./BallBehaviour";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {NetworkPredictionComponent} from "../../../network/components/NetworkPredictionComponent";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // components properties
    private _networkPredictionComponent!: NetworkPredictionComponent<InputStates>;
    private _networkAnimationComponent!: NetworkAnimationComponent;
    private _mesh!: B.Mesh;
    private _physicsAggregate!: B.PhysicsAggregate;
    public ballEntity!: B.Nullable<Entity>;
    private _isOwner!: boolean; // is the player the owner of the entity
    private _playerCollisionObserver!: B.Observer<B.IPhysicsCollisionEvent>;
    private _shootForce: number = 15;
    private _dropForce: number = 5;

    // movement
    private _speed: number = 5;
    private _velocity: B.Vector3 = B.Vector3.Zero();

    // tackle
    private _tackleDuration: number = 400;
    private _tackleCooldown: number = 2000;
    private _canTackle: boolean = true;
    private _tackleSpeed: number = 12;
    public isTackling: boolean = false;

    // inputs
    public readonly playerId!: string;

    constructor(entity: Entity, scene: Scene, props: {playerId: string}) {
        this.entity = entity;
        this.scene = scene;
        this.playerId = props.playerId;
    }

    public onStart(): void {
        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = meshComponent.mesh;

        const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        this._physicsAggregate = rigidBodyComponent.physicsAggregate;
        if (this.scene.game.networkInstance.isHost) {
            this._playerCollisionObserver = rigidBodyComponent.collisionObservable.add(this._onCollision.bind(this));
        }

        this._networkPredictionComponent = this.entity.getComponent("NetworkPrediction") as NetworkPredictionComponent<InputStates>;
        this._networkPredictionComponent.onApplyInput.add(this._applyPredictedInput.bind(this));

        this._networkAnimationComponent = this.entity.getComponent("NetworkAnimation") as NetworkAnimationComponent;

        this._isOwner = this.scene.game.networkInstance.playerId === this.playerId;
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
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
        this._movePlayer(inputs);
        this.scene.simulate([this._physicsAggregate.body]);
    }

    private _processInputStates(inputStates: InputStates): void {
        if (this.isTackling) return;

        this._movePlayer(inputStates);

        // rotate the models
        if (!this._velocity.equals(B.Vector3.Zero())) {
            const rotationY: number = Math.atan2(this._velocity.z, -this._velocity.x) - Math.PI / 2;
            this._mesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, rotationY, 0);
        }

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
        this._physicsAggregate.body.setLinearVelocity(this._velocity);
    }

    private _animate(inputStates: InputStates): void {
        const isInputPressed: boolean = inputStates.direction.x !== 0 || inputStates.direction.y !== 0;
        if (isInputPressed) {
            this._networkAnimationComponent.startAnimation("Walking");
        }
        else {
            this._networkAnimationComponent.startAnimation("Idle");
        }
    }

    private _shoot(ballEntity: Entity): void {
        const ballBehaviourComponent = ballEntity.getComponent("BallBehaviour") as BallBehaviour;
        const direction: B.Vector3 = this._mesh.forward.clone();
        ballBehaviourComponent.kickBall(direction, this._shootForce);
        this.ballEntity = null;

        this._blockTackle();
    }

    private _pass(ballEntity: Entity): void {
        const closestPlayer: B.Nullable<B.Mesh> = this._getClosestPlayerToPassTo();
        if (!closestPlayer) return;

        const direction: B.Vector3 = closestPlayer.position.subtract(this._mesh.position).normalize();
        const ballBehaviourComponent = ballEntity.getComponent("BallBehaviour") as BallBehaviour;
        ballBehaviourComponent.kickBall(direction, this._shootForce);

        this.ballEntity = null;

        this._blockTackle();
    }

    private _tackle(): void {
        this._velocity = this._mesh.forward.clone().scale(this._tackleSpeed);
        this._physicsAggregate.body.setLinearVelocity(this._velocity);

        this.isTackling = true;

        setTimeout((): void => {
            this.isTackling = false;
            this._blockTackle();
        }, this._tackleDuration);
    }

    private _blockTackle(): void {
        this._canTackle = false;
        setTimeout((): void => {
            this._canTackle = true;
        }, this._tackleCooldown);
    }

    private _minDistancePointLine(playerPosition: B.Vector3, passDirection: B.Vector3, targetPlayerPosition: B.Vector3): number {
        // position of targetPlayer relative to player
        const newTargetPlayerPosition: B.Vector3 = targetPlayerPosition.subtract(playerPosition);

        const dot: number = newTargetPlayerPosition.dot(passDirection);
        if (dot <= 0) {
            return 100;
        }
        // projection of targetPlayer on the pass direction
        const projection: B.Vector3 = passDirection.normalize().scale(dot);

        // distance between targetPlayer and the projection
        const distanceVector: B.Vector3 = newTargetPlayerPosition.subtract(projection);
        return distanceVector.length();
    }

    private _getClosestPlayerToPassTo(): B.Nullable<B.Mesh> {
        const players: Entity[] = this.scene.entityManager.getEntitiesByTag("player");
        let minDistance: number = 100;
        let closestPlayer: B.Nullable<B.Mesh> = null;

        players.forEach((playerEntity: Entity): void => {
            const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
            if (playerBehaviourComponent.playerId === this.playerId) return;

            const playerMeshComponent = playerEntity.getComponent("Mesh") as MeshComponent;
            const targetPlayerPosition: B.Vector3 = playerMeshComponent.mesh.position;
            const passDirection: B.Vector3 = this._mesh.forward.clone().normalize();
            const distance: number = this._minDistancePointLine(this._mesh.position, passDirection, targetPlayerPosition);

            if (distance < minDistance) {
                minDistance = distance;
                closestPlayer = playerMeshComponent.mesh;
            }
        });

        return closestPlayer;
    }

    private _onCollision(event: B.IPhysicsCollisionEvent): void {
        if (event.type !== B.PhysicsEventType.COLLISION_STARTED) return;

        const collidedAgainst: B.TransformNode = event.collidedAgainst.transformNode;
        const collider: B.TransformNode = event.collider.transformNode;

        if (collidedAgainst.metadata?.tag === "player") {
            this._handlePlayerCollision(collidedAgainst, collider);
        }
        else if (collidedAgainst.metadata?.tag === "ball") {
            this._handleBallCollision(collidedAgainst, collider);
        }
    }

    private _handlePlayerCollision(otherPlayerTransformNode: B.TransformNode, playerTransformNode: B.TransformNode): void {
        const otherPLayerEntity: Entity = this.scene.entityManager.getEntityById(otherPlayerTransformNode.metadata.id);
        const otherPlayerBehaviourComponent = otherPLayerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
        const otherPlayerMeshComponent = otherPLayerEntity.getComponent("Mesh") as MeshComponent;

        const playerEntity: Entity = this.scene.entityManager.getEntityById(playerTransformNode.metadata.id);
        const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
        const playerMeshComponent = playerEntity.getComponent("Mesh") as MeshComponent;

        // drop the ball if the player is tackling and the other player has the ball
        if (otherPlayerBehaviourComponent.ballEntity && playerBehaviourComponent.isTackling) {
            this._dropBall(otherPlayerBehaviourComponent, playerMeshComponent);
        }
        else if (playerBehaviourComponent.ballEntity && otherPlayerBehaviourComponent.isTackling) {
            this._dropBall(playerBehaviourComponent, otherPlayerMeshComponent);
        }
    }

    private _dropBall(ownerBehaviourComponent: PlayerBehaviour, tacklingPlayerMeshComponent: MeshComponent): void {
        const ballEntity: Entity = ownerBehaviourComponent.ballEntity!;
        const ballBehaviourComponent = ballEntity.getComponent("BallBehaviour") as BallBehaviour;
        ballBehaviourComponent.setOwner(null);
        ownerBehaviourComponent.ballEntity = null;

        // kick the ball in the direction of the tackle
        const direction: B.Vector3 = tacklingPlayerMeshComponent.mesh.forward.clone();
        ballBehaviourComponent.kickBall(direction, this._dropForce);
    }

    private _handleBallCollision(ballTransformNode: B.TransformNode, playerTransformNode: B.TransformNode): void {
        const ballEntity: Entity = this.scene.entityManager.getEntityById(ballTransformNode.metadata.id);
        const ballBehaviourComponent = ballEntity.getComponent("BallBehaviour") as BallBehaviour;

        const playerEntity: Entity = this.scene.entityManager.getEntityById(playerTransformNode.metadata.id);
        const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
        const playerMeshComponent = playerEntity.getComponent("Mesh") as MeshComponent;

        const previousOwner: B.Nullable<{playerId: string, entityId: string, mesh: B.Mesh}> = ballBehaviourComponent.getOwner();
        if (previousOwner) {
            // if the player already has the ball or is not tackling, do nothing
            if (previousOwner.playerId === playerBehaviourComponent.playerId || !playerBehaviourComponent.isTackling) return;
            // else tell the previous owner that he lost the ball
            else {
                const previousOwnerEntity: Entity = this.scene.entityManager.getEntityById(previousOwner.entityId);
                const previousOwnerBehaviourComponent = previousOwnerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
                previousOwnerBehaviourComponent.ballEntity = null;
            }
        }

        // give the ball to the player
        ballBehaviourComponent.setOwner({
            mesh: playerMeshComponent.mesh,
            playerId: playerBehaviourComponent.playerId,
            entityId: playerEntity.id
        });
        playerBehaviourComponent.ballEntity = ballEntity;
    }
}