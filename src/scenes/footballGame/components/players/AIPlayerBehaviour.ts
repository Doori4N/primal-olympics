import {Entity} from "../../../../core/Entity";
import {Scene} from "../../../../core/Scene";
import * as B from "@babylonjs/core";
import {Utils} from "../../../../utils/Utils";
import {MeshComponent} from "../../../../core/components/MeshComponent";
import {BallBehaviour} from "../BallBehaviour";
import {AbstractPlayerBehaviour} from "./AbstractPlayerBehaviour";
import {PlayerBehaviour} from "./PlayerBehaviour";

const PITCH_WIDTH: number = 42;
const PITCH_HEIGHT: number = 30;

enum AIPlayerState {
    WANDER,
    ATTACK,
    DEFENSE,
    BACK
}

export class AIPlayerBehaviour extends AbstractPlayerBehaviour {
    public name: string = "AIPlayerBehaviour";

    // component properties
    public state: AIPlayerState = AIPlayerState.WANDER;
    private _playerCollisionObserver!: B.Observer<B.IPhysicsCollisionEvent>;

    // debug
    private _range!: B.Mesh;

    // wander
    private _wanderArea!: {position: B.Vector2, size: number};
    private _actionTime: number = 0;
    private _isWaiting: boolean = false;

    // passing
    private _passRange: number = 10;
    private _isKicking: boolean = false;

    private _randomPointOffset: number;
    private _visionRange: number = 5;
    private _defenseRange: number = 10;
    private _ball!: Entity;

    constructor(entity: Entity, scene: Scene, props: {teamIndex: number, wanderArea: {position: B.Vector2, size: number}}) {
        super(entity, scene, props.teamIndex);
        this._wanderArea = props.wanderArea;
        this._randomPointOffset = Utils.randomFloat(-this._wanderArea.size / 2, this._wanderArea.size / 2);
    }

    public onStart(): void {
        super.onStart();

        this._networkAnimationComponent.startAnimation("Idle");

        if (this.scene.game.networkInstance.isHost) {
            this._playerCollisionObserver = this._rigidBodyComponent.collisionObservable.add(this._onCollision.bind(this));
        }

        this._debug();
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        this._range.position.x = this._mesh.position.x;
        this._range.position.z = this._mesh.position.z;

        const ball: Entity | null = this.scene.entityManager.getFirstEntityByTag("ball");
        if (!ball) return;
        this._ball = ball;

        if (!this._isGameStarted || this._isGameFinished) return;

        if (!this._isFrozen) switch (this.state) {
            case AIPlayerState.WANDER:
                this._wander();

                // transitions
                if (this._checkBallRange()) {
                    this.state = AIPlayerState.DEFENSE;
                    this._actionTime = 0;
                }
                else if (!this._isInWanderArea()) {
                    this.state = AIPlayerState.BACK;
                    this._actionTime = 0;
                }

                break;
            case AIPlayerState.BACK:
                this._back();

                // transitions
                if (this._isInWanderArea()) {
                    this.state = AIPlayerState.WANDER;
                    this._actionTime = 0;
                }

                break;
            case AIPlayerState.DEFENSE:
                if (this.isTackling) break;
                this._defense();

                // transitions
                if (!this._isInRange(new B.Vector3(this._wanderArea.position.x, 0, this._wanderArea.position.y), this._defenseRange)) this.state = AIPlayerState.BACK;
                else if (!this._checkBallRange()) this.state = AIPlayerState.BACK;
                else if (this.ballEntity) this.state = AIPlayerState.ATTACK;

                break;
            case AIPlayerState.ATTACK:
                this._attack();

                // transitions
                if (!this.ballEntity) {
                    this.state = AIPlayerState.DEFENSE;
                    this._actionTime = 0;
                }

                break;
        }

        this._move();
    }

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) this._playerCollisionObserver.remove();
    }

    private _back(): void {
        if (this._actionTime <= 0) {
            this._actionTime = 10000;
            // get a random point in the wander area
            const halfSize: number = this._wanderArea.size / 2;
            this._randomPointOffset = Utils.randomFloat(-halfSize, halfSize);
        }
        else {
            this._actionTime -= this.scene.game.tick;

            // follow the shortest path to the random point
            const path: number[] = this._getShortestPath([this._wanderArea.position.x + this._randomPointOffset, this._wanderArea.position.y + this._randomPointOffset]);
            if (path.length > 0) {
                this._networkAnimationComponent.startAnimation("Running", {smoothTransition: true, loop: true});
                this._followTarget(new B.Vector3(path[0], 0, path[1]));
            } else {
                this._velocity = B.Vector3.Zero();
                this._networkAnimationComponent.startAnimation("Idle", {smoothTransition: true, loop: true});
            }
        }
    }

    private _wander(): void {
        // wait for a random time before wandering
        if (this._isWaiting) {
            this._velocity = B.Vector3.Zero();
            return;
        }

        if (this._actionTime <= 0) {
            this._isWaiting = true;
            const waitingTime: number = Utils.randomFloat(0.5, 1.5) * 1000;
            this._networkAnimationComponent.startAnimation("Idle", {smoothTransition: true, loop: true});

            setTimeout((): void => {
                this._isWaiting = false;
                if (this.state !== AIPlayerState.WANDER) return;
                this._actionTime = Utils.randomFloat(1, 1.5) * 1000;
                const direction: B.Vector3 = new B.Vector3(Utils.randomFloat(-1, 1), 0, Utils.randomFloat(-1, 1)).normalize();
                this._velocity = direction.scale(this._speed);
                this._networkAnimationComponent.startAnimation("Running", {smoothTransition: true, loop: true});
            }, waitingTime);
        }
        else {
            this._actionTime -= this.scene.game.tick;
        }
    }

    private _isInWanderArea(): boolean {
        const position: B.Vector2 = new B.Vector2(this._mesh.position.x, this._mesh.position.z);
        const area: B.Vector2 = new B.Vector2(this._wanderArea.position.x, this._wanderArea.position.y);
        const halfSize: number = this._wanderArea.size / 2;

        return position.x >= area.x - halfSize && position.x <= area.x + halfSize &&
            position.y >= area.y - halfSize && position.y <= area.y + halfSize;
    }

    /**
     * Tells if the ball is in range and the owner is not in the same team
     */
    private _checkBallRange(): boolean {
        const ballBehaviourComponent = this._ball.getComponent("BallBehaviour") as BallBehaviour;
        const ballMeshComponent = this._ball.getComponent("Mesh") as MeshComponent;
        const ballOwner: B.Nullable<{playerId?: string, entityId: string, mesh: B.Mesh, teamIndex: number}> = ballBehaviourComponent.getOwner();

        if (this._isInRange(ballMeshComponent.mesh.position, this._visionRange)) {
            return !(ballOwner && ballOwner.teamIndex === this.teamIndex && ballOwner.entityId !== this.entity.id);
        }
        else {
            return false;
        }
    }

    private _defense(): void {
        const ballBehaviourComponent = this._ball.getComponent("BallBehaviour") as BallBehaviour;
        const ballOwner: B.Nullable<{playerId?: string, entityId: string, mesh: B.Mesh, teamIndex: number}> = ballBehaviourComponent.getOwner();

        this._networkAnimationComponent.startAnimation("Running", {smoothTransition: true, loop: true});

        // if an opponent has the ball chase the player
        if (ballOwner && ballOwner.entityId !== this.entity.id) {
            const playerEntity: Entity = this.scene.entityManager.getEntityById(ballOwner.entityId);
            const playerMeshComponent = playerEntity.getComponent("Mesh") as MeshComponent;

            // if the AI player is in range to tackle
            if (this._isInRange(playerMeshComponent.mesh.position, 2) && this._canTackle) {
                this._tackle();
            }
            else {
                this._followTarget(playerMeshComponent.mesh.position);
            }
        }
        else {
            // chase the ball with the shortest path
            const ballMeshComponent = this._ball.getComponent("Mesh") as MeshComponent;
            const path: number[] = this._getShortestPath([ballMeshComponent.mesh.position.x, ballMeshComponent.mesh.position.z]);
            if (path.length > 0) {
                this._followTarget(new B.Vector3(path[0], 0, path[1]));
            }
        }
    }

    private _attack(): void {
        if (this._actionTime <= 0) {
            const enemyGoal = new B.Vector3((this.teamIndex === 0) ? PITCH_WIDTH / 2 - 1 : -PITCH_WIDTH / 2, 0, 0);
            if (this._isInRange(enemyGoal, 9) && this.ballEntity) {
                this._shoot(this.ballEntity);
                return;
            }

            this._actionTime = Utils.randomFloat(2, 3) * 1000;
            this._networkAnimationComponent.startAnimation("Running", {smoothTransition: true, loop: true});

            const randomChoice: number = Utils.randomInt(1, 10);

            // try to pass the ball
            const freePlayer: B.Nullable<Entity> = this._getFreePlayer();
            if (randomChoice <= 4 && freePlayer && this.ballEntity) {
                this._pass(freePlayer);
            }
            // move randomly
            else if (randomChoice <= 7) {
                const randomDirectionX: number = Utils.randomFloat(-1, 1);
                const direction: B.Vector3 = new B.Vector3(randomDirectionX, 0, Utils.randomFloat(-1, 1)).normalize();
                this._velocity = direction.scale(this._speed);
            }
            // move towards the goal
            else {
                const path: number[] = this._getShortestPath([enemyGoal.x, enemyGoal.z]);
                if (path.length > 0) {
                    this._followTarget(new B.Vector3(path[0], 0, path[1]));
                }
            }
        }
        else {
            this._actionTime -= this.scene.game.tick;
        }
    }

    private _shoot(ballEntity: Entity): void {
        this._isKicking = true;
        setTimeout((): void => {
            this._isKicking = false;
        }, 1000);

        const ballBehaviourComponent = ballEntity.getComponent("BallBehaviour") as BallBehaviour;
        const direction: B.Vector3 = this._mesh.forward.clone();
        this._networkAnimationComponent.startAnimation("Kicking", {to: 75});
        this._networkAudioComponent.playSound("Kick", {offset: 0, duration: 1, volume: 0.5});
        this._freezePlayer(this._shootDuration);

        setTimeout((): void => {
            ballBehaviourComponent.kickBall(direction, this._shootForce);
            this.ballEntity = null;
            // delay the tackle to avoid the player to tackle right after shooting
            this.blockTackle();
        }, this._shootDelay);
    }

    private _pass(teammate: Entity): void {
        this._isKicking = true;
        setTimeout((): void => {
            this._isKicking = false;
        }, 1000);

        this._freezePlayer(500);

        // rotate the player in the direction of the teammate
        const playerMeshComponent = teammate.getComponent("Mesh") as MeshComponent;
        const direction: B.Vector3 = playerMeshComponent.mesh.position.subtract(this._mesh.position).normalize();
        const rotationY: number = Math.atan2(direction.z, -direction.x) - Math.PI / 2;
        this._mesh.rotationQuaternion = B.Quaternion.FromEulerAngles(0, rotationY, 0);

        // delay the pass so the player can rotate
        setTimeout((): void => {
            // if the player loose the ball return
            if (!this.ballEntity) return;

            // pass the ball
            this._networkAnimationComponent.startAnimation("Kicking", {from: 27, to: 60, smoothTransition: true});
            this._networkAudioComponent.playSound("Kick", {offset: 0.3, duration: 1, volume: 0.5});
            const ballBehaviourComponent = this.ballEntity.getComponent("BallBehaviour") as BallBehaviour;
            ballBehaviourComponent.kickBall(direction, this._shootForce);
            this.ballEntity = null;

            // delay the tackle to avoid the player to tackle right after passing
            this.blockTackle();
        }, 100);
    }

    private _isInRange(target: B.Vector3, range: number): boolean {
        return B.Vector3.Distance(this._mesh.position, target) <= range;
    }

    private _getFreePlayer(): B.Nullable<Entity> {
        let freePlayer: B.Nullable<Entity> = null;
        let smallestDistance: number = Number.MAX_VALUE;

        const players: Entity[] = this.scene.entityManager.getEntitiesByTag("player");
        players.forEach((player: Entity): void => {
            const playerMeshComponent = player.getComponent("Mesh") as MeshComponent;
            const playerBehaviourComponent = player.getComponent("PlayerBehaviour") as PlayerBehaviour;
            if (playerBehaviourComponent.teamIndex !== this.teamIndex) return;

            const raycastResult: B.PhysicsRaycastResult | undefined = this.scene.babylonScene._physicsEngine?.raycast(this._mesh.position, playerMeshComponent.mesh.position);
            if (raycastResult && raycastResult.body?.transformNode?.metadata?.id === player.id) {
                const distance: number = B.Vector3.Distance(this._mesh.position, playerMeshComponent.mesh.position);
                if (distance < smallestDistance) {
                    freePlayer = player;
                    smallestDistance = distance;
                }
            }
        });

        const aiPlayers: Entity[] = this.scene.entityManager.getEntitiesByTag("aiPlayer");
        aiPlayers.forEach((aiPlayer: Entity): void => {
            const aiPlayerMeshComponent = aiPlayer.getComponent("Mesh") as MeshComponent;
            const aiPlayerBehaviourComponent = aiPlayer.getComponent("AIPlayerBehaviour") as AIPlayerBehaviour;
            if (aiPlayerBehaviourComponent.teamIndex !== this.teamIndex) return;

            const raycastResult: B.PhysicsRaycastResult | undefined = this.scene.babylonScene._physicsEngine?.raycast(this._mesh.position, aiPlayerMeshComponent.mesh.position);
            if (raycastResult && raycastResult.body?.transformNode?.metadata?.id === aiPlayer.id) {
                const distance: number = B.Vector3.Distance(this._mesh.position, aiPlayerMeshComponent.mesh.position);
                if (distance < smallestDistance) {
                    freePlayer = aiPlayer;
                    smallestDistance = distance;
                }
            }
        });

        if (smallestDistance > this._passRange) freePlayer = null;
        return freePlayer;
    }

    private _followTarget(target: B.Vector3): void {
        const direction: B.Vector3 = new B.Vector3(target.x - this._mesh.position.x, 0, target.z - this._mesh.position.z).normalize();
        this._velocity = direction.scale(this._speed);
        this._networkAnimationComponent.startAnimation("Running", {smoothTransition: true});
    }

    private _onCollision(event: B.IPhysicsCollisionEvent): void {
        if (event.type !== B.PhysicsEventType.COLLISION_CONTINUED) return;

        const collidedAgainst: B.TransformNode = event.collidedAgainst.transformNode;

        if (collidedAgainst.metadata?.tag === "aiPlayer") {
            this._handlePlayerCollision(collidedAgainst);
        }
        // check if the player is not passing so the ball don't stick to the player
        else if (collidedAgainst.metadata?.tag === "ball" && !this._isKicking) {
            this._handleBallCollision(collidedAgainst);
        }
    }

    private _handleBallCollision(ballTransformNode: B.TransformNode): void {
        if (this._isFrozen) return;

        const ballEntity: Entity = this.scene.entityManager.getEntityById(ballTransformNode.metadata.id);
        const ballBehaviourComponent = ballEntity.getComponent("BallBehaviour") as BallBehaviour;

        const previousOwner: B.Nullable<{playerId?: string, entityId: string, mesh: B.Mesh}> = ballBehaviourComponent.getOwner();
        if (previousOwner) {
            // if the AI player is not tackling, return
            if (!this.isTackling) return;

            // else tell the previous owner that he lost the ball
            const previousOwnerEntity: Entity = this.scene.entityManager.getEntityById(previousOwner.entityId);
            let previousOwnerBehaviour: AbstractPlayerBehaviour;
            if (previousOwner.playerId) previousOwnerBehaviour = previousOwnerEntity.getComponent("PlayerBehaviour") as AbstractPlayerBehaviour;
            else previousOwnerBehaviour = previousOwnerEntity.getComponent("AIPlayerBehaviour") as AbstractPlayerBehaviour;
            previousOwnerBehaviour.ballEntity = null;
            previousOwnerBehaviour.stun();
        }

        // give the ball to the player
        ballBehaviourComponent.setOwner({
            mesh: this._mesh,
            playerId: undefined,
            teamIndex: this.teamIndex,
            entityId: this.entity.id
        });
        this.ballEntity = ballEntity;
    }

    private _getShortestPath(endPoint: number[]): number[] {
        const grid: number[][] = [];

        // init grid
        for (let i: number = 0; i < PITCH_WIDTH; i++) {
            grid[i] = [];
            for (let j: number = 0; j < PITCH_HEIGHT; j++) {
                grid[i][j] = 0;
            }
        }

        const players: Entity[] = this.scene.entityManager.getEntitiesByTag("player");
        players.push(...this.scene.entityManager.getEntitiesByTag("aiPlayer"));

        const offsetX: number = PITCH_WIDTH / 2;
        const offsetY: number = PITCH_HEIGHT / 2;

        const neighbors: number[][] = [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1]
        ];

        players.forEach((player: Entity): void => {
            try {
                if (player.id === this.entity.id) return;
                const playerMeshComponent = player.getComponent("Mesh") as MeshComponent;
                const playerPosition: B.Vector3 = playerMeshComponent.mesh.position;
                grid[Math.round(playerPosition.x) + offsetX][Math.round(playerPosition.z) + offsetY] = 1;

                // put obstacles around the player
                for (let neighbor of neighbors) {
                    if (Math.round(playerPosition.x) + offsetX + neighbor[0] >= 0 && Math.round(playerPosition.x) + offsetX + neighbor[0] < PITCH_WIDTH &&
                        Math.round(playerPosition.z) + offsetY + neighbor[1] >= 0 && Math.round(playerPosition.z) + offsetY + neighbor[1] < PITCH_HEIGHT) {
                        grid[Math.round(playerPosition.x) + offsetX + neighbor[0]][Math.round(playerPosition.z) + offsetY + neighbor[1]] = 1;
                    }
                }
            }
            catch (e) {
                const playerMeshComponent = player.getComponent("Mesh") as MeshComponent;
                const playerPosition: B.Vector3 = playerMeshComponent.mesh.position;
                grid[Math.round(playerPosition.x) + offsetX][Math.round(playerPosition.z) + offsetY] = 1;
            }
        });

        const start: number[] = [Math.round(this._mesh.position.x) + offsetX, Math.round(this._mesh.position.z) + offsetY];
        grid[start[0]][start[1]] = 2;
        endPoint[0] = Math.round(endPoint[0]) + offsetX;
        endPoint[1] = Math.round(endPoint[1]) + offsetY;

        const path: number[][] | null = Utils.astar(grid, start, endPoint);
        if (path && path.length > 1) {
            const target: number[] = path[1];
            target[0] -= offsetX;
            target[1] -= offsetY;
            return target;
        }
        else return [];
    }

    private _debug(): void {
        const plane: B.Mesh = B.MeshBuilder.CreatePlane("wanderArea", {size: this._wanderArea.size}, this.scene.babylonScene);
        plane.isVisible = false;
        plane.position.y = 0.1;
        plane.position.x = this._wanderArea.position.x;
        plane.position.z = this._wanderArea.position.y;
        plane.rotate(B.Axis.X, Math.PI / 2, B.Space.WORLD);

        const material = new B.StandardMaterial("material", this.scene.babylonScene);
        material.diffuseColor = new B.Color3(0, 0, 1);
        material.alpha = 0.5;
        plane.material = material;

        this._range = B.MeshBuilder.CreateDisc("range", {radius: this._visionRange}, this.scene.babylonScene);
        this._range.isVisible = false;
        this._range.position.y = 0.1;
        this._range.position.x = this._mesh.position.x;
        this._range.position.z = this._mesh.position.z;
        this._range.rotate(B.Axis.X, Math.PI / 2, B.Space.WORLD);

        const rangeMaterial = new B.StandardMaterial("material", this.scene.babylonScene);
        rangeMaterial.diffuseColor = new B.Color3(1, 0, 0);
        rangeMaterial.alpha = 0.2;
        this._range.material = rangeMaterial;
    }
}