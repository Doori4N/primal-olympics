import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {InputStates} from "../../../core/types";
import {NetworkHost} from "../../../network/NetworkHost";
import {NetworkMeshComponent} from "../../../network/components/NetworkMeshComponent";
import {NetworkAnimationComponent} from "../../../network/components/NetworkAnimationComponent";
import {NetworkRigidBodyComponent} from "../../../network/components/NetworkRigidBodyComponent";
import {RigidBodyComponent} from "../../../core/components/RigidBodyComponent";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {NetworkInputsComponent} from "../../../network/components/NetworkInputsComponent";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // components
    private _modelMesh!: B.Mesh;
    private _hitbox!: B.Mesh;
    private _physicsAggregate!: B.PhysicsAggregate;
    private _networkRigidBodyComponent!: NetworkRigidBodyComponent;
    private _networkMeshComponent!: NetworkMeshComponent;
    private _networkAnimationComponent!: NetworkAnimationComponent;
    private _networkInputsComponent!: NetworkInputsComponent;

    // properties
    private _isGameStarted: boolean = false;
    private _isGameFinished: boolean = false;
    private readonly _isOwner!: boolean; // is the player the owner of the entity
    private _observer!: B.Observer<B.IBasePhysicsCollisionEvent>;

    // movement
    private _speed: number = 4.5;
    private _lastDirection: number = 0;
    public velocity: B.Vector3 = B.Vector3.Zero();

    // push
    private _collisionBoxLifeSpan: number = 200;
    private _pushCooldown: number = 2000;
    private _canPush: boolean = true;
    private _pushDelay: number = 200;
    private _pushDuration: number = 500;
    private _pushForce: number = 10;
    private _isPushed: boolean = false;

    // inputs
    public readonly playerId!: string;

    constructor(entity: Entity, scene: Scene, props: {playerId: string}) {
        this.entity = entity;
        this.scene = scene;
        this.playerId = props.playerId;
        this._isOwner = this.scene.game.networkInstance.playerId === this.playerId;
    }

    public onStart(): void {
        this._networkInputsComponent = this.entity.getComponent("NetworkInputs") as NetworkInputsComponent;

        if (!this.scene.game.networkInstance.isHost && !this._isOwner) return;

        // network mesh component
        this._networkMeshComponent = this.entity.getComponent("NetworkMesh") as NetworkMeshComponent;
        this._hitbox = this._networkMeshComponent.mesh;
        this._modelMesh = this._networkMeshComponent.meshRotation;

        // network rigid body component
        this._networkRigidBodyComponent = this.entity.getComponent("NetworkRigidBody") as NetworkRigidBodyComponent;
        this._physicsAggregate = this._networkRigidBodyComponent.physicsAggregate;
        this._networkRigidBodyComponent.onApplyInput = this._applyPredictedInput.bind(this);

        this._networkAnimationComponent = this.entity.getComponent("NetworkAnimation") as NetworkAnimationComponent;

        // subscribe to game events
        this.scene.eventManager.subscribe("onGameStarted", this._onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this._onGameFinished.bind(this));

        if (this.scene.game.networkInstance.isHost) {
            const observable: B.Observable<B.IBasePhysicsCollisionEvent> = this.scene.game.physicsPlugin.onTriggerCollisionObservable;
            this._observer = observable.add(this._onTriggerCollision.bind(this));
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        if (!this._isGameStarted || this._isGameFinished) return;
        if (this.scene.game.networkInstance.isHost) this._handleServerUpdate();
        else this._handleClientUpdate();
    }

    public onDestroy(): void {
        if (this.scene.game.networkInstance.isHost) this._observer.remove();
    }

    /**
     * Get the direction of where the player is moving
     */
    private _getDirection(velocity: B.Vector3): number {
        if (velocity.equals(B.Vector3.Zero())) {
            return this._lastDirection;
        }
        this._lastDirection = Math.atan2(velocity.z, -velocity.x) - Math.PI / 2;
        return this._lastDirection;
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

    public kill(): void {
        this.scene.entityManager.destroyEntity(this.entity);
        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients("onDestroyPlayer", {entityId: this.entity.id});
    }

    private _onGameStarted(): void {
        this._isGameStarted = true;
    }

    private _onGameFinished(): void {
        this._isGameFinished = true;
    }

    private _handleClientUpdate(): void {
        const inputStates: InputStates = this.scene.game.inputManager.cloneInputStates(this.scene.game.inputManager.inputStates);
        this._networkInputsComponent.sendInputStates(inputStates);

        // client prediction
        if (this._isOwner) {
            this._processInputStates(inputStates);
            this._networkRigidBodyComponent.predict(inputStates);
            this._animate(inputStates);
        }
    }

    private _handleServerUpdate(): void {
        if (this._isOwner) {
            const inputStates: InputStates = this.scene.game.inputManager.inputStates;
            this._processInputStates(inputStates);
            this._networkRigidBodyComponent.sendAuthoritativePhysics(inputStates.tick, this.velocity.clone());
            this._animate(inputStates);
        }
        else {
            const inputs: InputStates[] = this._networkInputsComponent.getInputs();
            for (let i: number = 0; i < inputs.length; i++) {
                const inputStates: InputStates = inputs[i];
                this._processInputStates(inputStates);
                this._networkRigidBodyComponent.sendAuthoritativePhysics(inputStates.tick, this.velocity.clone());
                this._animate(inputStates);
                // don't simulate the last input because it will be simulated automatically in this frame
                if (i < inputs.length - 1) {
                    this._networkRigidBodyComponent.simulate();
                }
            }
        }
    }

    private _processInputStates(inputStates: InputStates): void {
        if (this._isPushed) return;

        this._movePlayer(inputStates);
        if (this.scene.game.networkInstance.isHost) this._checkPush(inputStates);

        // rotate the model
        // set z rotation to 180 degrees cause the imported model is inverted (best solution for now)
        this._modelMesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, this._getDirection(this.velocity), Math.PI);
    }

    /**
     * Re-apply the predicted input and simulate physics
     */
    private _applyPredictedInput(inputs: InputStates): void {
        this._movePlayer(inputs);
        this._networkRigidBodyComponent.simulate();
    }

    /**
     * Set the linear velocity of the player according to his inputs
     */
    private _movePlayer(inputs: InputStates): void {
        this.velocity = new B.Vector3(inputs.direction.x, 0, inputs.direction.y).normalize();
        this.velocity.scaleInPlace(this._speed);
        this._physicsAggregate.body.setLinearVelocity(this.velocity);
    }

    /**
     * Check if the player can push other players and create a collision box
     */
    private _checkPush(inputStates: InputStates): void {
        if (!inputStates.buttons["jump"] || !this._canPush) return;

        setTimeout((): void => {
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
        const collisionBox: B.Mesh = B.MeshBuilder.CreateBox("collisionBox", {size: 1}, this.scene.babylonScene);
        collisionBox.isVisible = false;

        const direction: B.Vector3 = new B.Vector3(
            Math.round(this._modelMesh.forward.x * 100) / 100,
            0,
            Math.round(this._modelMesh.forward.z * 100) / 100
        );
        const offset: B.Vector3 = direction.clone().scale(1.5).addInPlaceFromFloats(0.5, 0.5, 0.5);
        collisionBox.position = this._hitbox.position.add(offset);

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
            this.scene.entityManager.destroyEntity(collisionBoxEntity);
        }, this._collisionBoxLifeSpan);
    }

    /**
     * Push the player in the direction of the impulse
     */
    public pushPlayer(impulseDirection: B.Vector3): void {
        this._isPushed = true;

        this.velocity = impulseDirection.scale(this._pushForce);
        this._physicsAggregate.body.setLinearVelocity(this.velocity);

        setTimeout((): void => {
            this._isPushed = false;
        }, this._pushDuration);
    }

    private _onTriggerCollision(collisionEvent: B.IBasePhysicsCollisionEvent): void {
        if (collisionEvent.type !== "TRIGGER_ENTERED") return;

        // player collision
        else if (collisionEvent.collider.transformNode.metadata?.tag === "player" &&
            collisionEvent.collidedAgainst.transformNode.metadata?.tag === "collisionBox"
        ) {
            if (collisionEvent.collidedAgainst.transformNode.metadata?.ownerId === this.entity.id) return;

            const impulseDirection: B.Vector3 = collisionEvent.collidedAgainst.transformNode.metadata?.direction;

            const playerEntity: Entity = this.scene.entityManager.getEntityById(collisionEvent.collider.transformNode.metadata?.id);
            const playerBehaviourComponent = playerEntity.getComponent("PlayerBehaviour") as PlayerBehaviour;
            playerBehaviourComponent.pushPlayer(impulseDirection);
        }
    }
}
