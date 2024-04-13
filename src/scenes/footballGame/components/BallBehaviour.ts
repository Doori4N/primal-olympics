import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {PlayerBehaviour} from "./PlayerBehaviour";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {NetworkPredictionComponent} from "../../../network/components/NetworkPredictionComponent";
import {NetworkHost} from "../../../network/NetworkHost";
import {InputStates} from "../../../core/types";

export class BallBehaviour implements IComponent {
    public name: string = "BallBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _networkPredictionComponent!: NetworkPredictionComponent<B.Vector3>;
    private _physicsAggregate!: B.PhysicsAggregate;
    private _mesh!: B.Mesh;
    private _velocity: B.Vector3 = B.Vector3.Zero();
    private _ballOwner!: B.Nullable<{playerId: string, entityId: string, mesh: B.Mesh}>;
    private _slowDown: number = 0.98;

    // event listeners
    private _onBallOwnerUpdateEvent = this._onBallOwnerUpdate.bind(this);

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        this._networkPredictionComponent = this.entity.getComponent("NetworkPrediction") as NetworkPredictionComponent<B.Vector3>;
        this._networkPredictionComponent.onApplyInput.add(this._applyPredictedInput.bind(this));

        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this._mesh = meshComponent.mesh;

        // CLIENT
        if (!this.scene.game.networkInstance.isHost) {
            this.scene.game.networkInstance.addEventListener("onBallOwnerUpdate", this._onBallOwnerUpdateEvent);
        }
        // HOST
        else {
            const rigidBodyComponent = this.entity.getComponent("RigidBody") as RigidBodyComponent;
            this._physicsAggregate = rigidBodyComponent.physicsAggregate;

            this.scene.eventManager.subscribe("onGoalScored", this._onGoalScored.bind(this));
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) this._handleServerUpdate();
        // CLIENT
        else this._handleClientUpdate();
    }

    public onDestroy(): void {
        // CLIENT
        if (!this.scene.game.networkInstance.isHost) {
            this.scene.game.networkInstance.removeEventListener("onBallOwnerUpdate", this._onBallOwnerUpdateEvent);
        }

    }

    private _handleServerUpdate(): void {
        if (this._ballOwner) {
            this._followOwner(this._ballOwner.mesh);

            if (this._ballOwner.playerId === this.scene.game.networkInstance.playerId) {
                this._networkPredictionComponent.sendTransformUpdate(this.scene.game.tickIndex, this._mesh.position.clone());
            }
            else {
                const playerInputs: InputStates[] = this.scene.game.networkInputManager.getPlayerInput(this._ballOwner.playerId);
                playerInputs.forEach((input: InputStates): void => {
                    this._networkPredictionComponent.sendTransformUpdate(input.tick, this._mesh.position.clone());
                });
            }
        }
        else {
            this._applyVelocity();
            this._networkPredictionComponent.sendTransformUpdate(this.scene.game.tickIndex, this._mesh.position.clone());
        }
    }

    private _handleClientUpdate(): void {
        if (!this._ballOwner) return;

        // if the owner of the ball is the client, then predict the ball's movement
        if (this._ballOwner.playerId === this.scene.game.networkInstance.playerId) {
            this._followOwner(this._ballOwner.mesh);
            this._networkPredictionComponent.predict(this._mesh.position.clone(), this.scene.game.inputManager.inputStates.tick);
        }
    }

    private _followOwner(ownerMesh: B.Mesh): void {
        const offset: B.Vector3 = ownerMesh.forward.clone();
        offset.y -= 0.5;

        this._mesh.position = ownerMesh.position.clone().add(offset);
    }

    public kickBall(direction: B.Vector3, force: number): void {
        this._ballOwner = null;

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients("onBallOwnerUpdate", null);

        this._velocity = direction.scale(force);
    }

    private _applyVelocity(): void {
        if (Math.abs(this._velocity.x) > 0.5 || Math.abs(this._velocity.z) > 0.5) {
            this._velocity.scaleInPlace(this._slowDown);
        }
        else {
            this._velocity = B.Vector3.Zero();
        }
        const body: B.PhysicsBody = this._physicsAggregate.body;
        body.setLinearVelocity(this._velocity);
    }

    private _onGoalScored(): void {
        this._ballOwner = null;
        this._velocity = B.Vector3.Zero();
    }

    private _applyPredictedInput(position: B.Vector3): void {
        this._mesh.position = position;
    }

    private _onBallOwnerUpdate(playerEntityId: B.Nullable<string>): void {
        // if the player drops the ball
        if (!playerEntityId) {
            this._ballOwner = null;
            return;
        }

        // else if the player picks up the ball
        const playerEntity: Entity = this.scene.entityManager.getEntityById(playerEntityId);
        const playerMeshComponent = playerEntity.getComponent("Mesh") as MeshComponent;
        const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;

        this._ballOwner = {
            mesh: playerMeshComponent.mesh,
            playerId: playerBehaviourComponent.playerId,
            entityId: playerEntityId
        };
    }

    public setOwner(owner: B.Nullable<{mesh: B.Mesh, playerId: string, entityId: string}>): void {
        this._ballOwner = owner;

        // notify clients that the ball has a new owner
        const networkHost = this.scene.game.networkInstance as NetworkHost;
        if (owner) networkHost.sendToAllClients("onBallOwnerUpdate", owner.entityId);
        else networkHost.sendToAllClients("onBallOwnerUpdate", null);
    }

    public getOwner(): B.Nullable<{playerId: string, entityId: string, mesh: B.Mesh}> {
        return this._ballOwner;
    }
}