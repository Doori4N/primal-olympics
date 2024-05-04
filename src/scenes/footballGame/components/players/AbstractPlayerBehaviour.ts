import {IComponent} from "../../../../core/IComponent";
import {Entity} from "../../../../core/Entity";
import * as B from "@babylonjs/core";
import {MeshComponent} from "../../../../core/components/MeshComponent";
import {BallBehaviour} from "../BallBehaviour";
import {Scene} from "../../../../core/Scene";
import {RigidBodyComponent} from "../../../../core/components/RigidBodyComponent";
import {NetworkAnimationComponent} from "../../../../network/components/NetworkAnimationComponent";
import {NetworkAudioComponent} from "../../../../network/components/NetworkAudioComponent";

export abstract class AbstractPlayerBehaviour implements IComponent {
    public name: string = "AbstractPlayerBehaviour";
    public entity: Entity;
    public scene: Scene;
    protected _isGameStarted: boolean = false;
    protected _isGameFinished: boolean = false;
    protected _networkAnimationComponent!: NetworkAnimationComponent;
    protected _networkAudioComponent!: NetworkAudioComponent;
    protected _rigidBodyComponent!: RigidBodyComponent;
    protected _physicsAggregate!: B.PhysicsAggregate;
    protected _mesh!: B.Mesh;
    public teamIndex: number;

    public _isHighlighted = false;

    // movement
    protected _speed: number = 5;
    protected _velocity: B.Vector3 = B.Vector3.Zero();
    protected _isFrozen: boolean = false;

    public ballEntity!: B.Nullable<Entity>;

    // shoot
    protected _shootDelay: number = 450;
    protected _shootDuration: number = 1200;
    protected _shootForce: number = 15;

    // tackle
    protected _tackleDuration: number = 1000;
    protected _tackleCooldown: number = 2500;
    protected _dropForce: number = 10;
    public isTackling: boolean = false;
    protected _canTackle: boolean = true;
    protected _tackleSpeed: number = 8;

    // stun
    protected _stunDuration: number = 2000;

    protected constructor(entity: Entity, scene: Scene, teamIndex: number) {
        this.entity = entity;
        this.scene = scene;
        this.teamIndex = teamIndex;
    }

    public onStart(): void {
        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = meshComponent.mesh;

        this._networkAnimationComponent = this.entity.getComponent("NetworkAnimation") as NetworkAnimationComponent;
        this._networkAudioComponent = this.entity.getComponent("NetworkAudio") as NetworkAudioComponent;

        this._rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
        this._physicsAggregate = this._rigidBodyComponent.physicsAggregate;

        // subscribe to game events
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));
    }

    public abstract onUpdate(): void;

    public abstract onFixedUpdate(): void;

    public abstract onDestroy(): void;

    /**
     * - Move the player by setting the velocity of the physics body
     * - Rotate the player mesh in the direction of the velocity
     * - And update the ball rotation if the player has the ball
     */
    protected _move(): void {
        this._physicsAggregate.body.setLinearVelocity(this._velocity);

        // rotate mesh
        if (!this._velocity.equals(B.Vector3.Zero())) {
            const rotationY: number = Math.atan2(this._velocity.z, -this._velocity.x) - Math.PI / 2;
            this._mesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, rotationY, 0);
        }

        // update the ball rotation if the player has the ball and is moving
        if (this.ballEntity && this._mesh.rotationQuaternion && !this._velocity.equals(B.Vector3.Zero())) {
            const ballBehaviourComponent = this.ballEntity.getComponent("BallBehaviour") as BallBehaviour;
            ballBehaviourComponent.rotateBall(this._mesh.rotationQuaternion);
        }
    }

    /**
     * Make the player tackle in the direction of the movement
     * @protected
     */
    protected _tackle(): void {
        this._networkAnimationComponent.startAnimation("Tackling");

        this._velocity = this._mesh.forward.clone().scale(this._tackleSpeed);
        this._physicsAggregate.body.setLinearVelocity(this._velocity);

        this.isTackling = true;

        setTimeout((): void => {
            this.isTackling = false;
            this.blockTackle();
        }, this._tackleDuration);
    }

    /**
     * Block the tackle for a certain amount of time to prevent spamming
     */
    public blockTackle(): void {
        this._canTackle = false;
        setTimeout((): void => {
            this._canTackle = true;
        }, this._tackleCooldown);
    }

    /**
     * Get the minimum distance between a teammate and the line of the pass
     */
    protected _minDistancePointLine(playerPosition: B.Vector3, passDirection: B.Vector3, targetPlayerPosition: B.Vector3): number {
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

    /**
     * Freeze the player for a certain amount of time
     */
    protected _freezePlayer(timestamp: number): void {
        this._isFrozen = true;
        this._velocity = B.Vector3.Zero();

        setTimeout((): void => {
            this._isFrozen = false;
        }, timestamp);
    }

    protected _handlePlayerCollision(otherPlayerTransformNode: B.TransformNode): void {
        // OTHER PLAYER
        const otherPlayerEntity: Entity = this.scene.entityManager.getEntityById(otherPlayerTransformNode.metadata.id);

        let otherAbstractPlayerBehaviour: AbstractPlayerBehaviour;
        if (otherPlayerTransformNode.metadata.tag === "player") otherAbstractPlayerBehaviour = otherPlayerEntity.getComponent("PlayerBehaviour") as AbstractPlayerBehaviour;
        else otherAbstractPlayerBehaviour = otherPlayerEntity.getComponent("AIPlayerBehaviour") as AbstractPlayerBehaviour;

        const otherPlayerMeshComponent = otherPlayerEntity.getComponent("Mesh") as MeshComponent;

        // PLAYER
        let playerAbstractBehaviourComponent: AbstractPlayerBehaviour;
        if (this._mesh.metadata.tag === "player") playerAbstractBehaviourComponent = this.entity.getComponent("PlayerBehaviour") as AbstractPlayerBehaviour;
        else playerAbstractBehaviourComponent = this.entity.getComponent("AIPlayerBehaviour") as AbstractPlayerBehaviour;

        const playerMeshComponent = this.entity.getComponent("Mesh") as MeshComponent;

        // drop the ball if the player is tackling and the other player has the ball
        if (otherAbstractPlayerBehaviour.ballEntity && playerAbstractBehaviourComponent.isTackling) {
            otherAbstractPlayerBehaviour.stun();
            this._dropBall(otherAbstractPlayerBehaviour, playerMeshComponent);
        }
        // drop the ball if the other player is tackling and the player has the ball
        else if (playerAbstractBehaviourComponent.ballEntity && otherAbstractPlayerBehaviour.isTackling) {
            playerAbstractBehaviourComponent.stun();
            this._dropBall(playerAbstractBehaviourComponent, otherPlayerMeshComponent);
        }
    }

    /**
     * Drop the ball when a player is tackled and reset ownership
     */
    protected _dropBall(ownerBehaviourComponent: AbstractPlayerBehaviour, tacklingPlayerMeshComponent: MeshComponent): void {
        const ballEntity: Entity = ownerBehaviourComponent.ballEntity!;
        const ballBehaviourComponent = ballEntity.getComponent("BallBehaviour") as BallBehaviour;
        ballBehaviourComponent.setOwner(null);
        ownerBehaviourComponent.ballEntity = null;

        // kick the ball in the direction of the tackle
        const direction: B.Vector3 = tacklingPlayerMeshComponent.mesh.forward.clone();
        ballBehaviourComponent.kickBall(direction, this._dropForce);
    }

    /**
     * Stun the player for a certain amount of time
     */
    public stun(): void {
        this._freezePlayer(this._stunDuration);
        this._networkAnimationComponent.startAnimation("Tackle_Reaction", {smoothTransition: true});

        const highlightLayer = new B.HighlightLayer("highlightLayer", this.scene.babylonScene);
        const skinMesh = this._mesh.getChildMeshes(false, (node: B.Node): boolean => {
            return node.name === `Personnage_primitive2${this.entity.id}`;
        })[0] as B.Mesh;

        // start highlight blink effect
        setInterval((): void => {
            if (this._isHighlighted) {
                highlightLayer.removeMesh(skinMesh);
                this._isHighlighted = false;
            }
            else {
                highlightLayer.addMesh(skinMesh, B.Color3.FromHexString("#222222"));
                this._isHighlighted = true;
            }
        }, 150);

        // stop highlight effect after the stun duration
        setTimeout((): void => {
            highlightLayer.removeMesh(skinMesh);
            highlightLayer.dispose();
        }, this._stunDuration);
    }

    protected _onGameStarted(): void {
        this._isGameStarted = true;
    }

    protected _onGameFinished(): void {
        this._isGameFinished = true;
    }
}