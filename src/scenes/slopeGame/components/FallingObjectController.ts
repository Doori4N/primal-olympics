import { Entity } from "../../../core/Entity";
import { IComponent } from "../../../core/IComponent";
import { Scene } from "../../../core/Scene";
import * as B from '@babylonjs/core';
import { MeshComponent } from "../../../core/components/MeshComponent";
import { RigidBodyComponent } from "../../../core/components/RigidBodyComponent";
import {Utils} from "../../../utils/Utils";
import {FallingObjectBehaviour} from "./FallingObjectBehaviour";

export class FallingObjectController implements IComponent {
    public name: string = "FallingObjectController";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _intervalId!: number;

    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            this.scene.eventManager.subscribe("onGameStarted", this.startSpawning.bind(this));
            this.scene.eventManager.subscribe("onGameFinished", this.stopSpawning.bind(this));
        }
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        // HOST
        if (this.scene.game.networkInstance.isHost) {
            this.scene.eventManager.unsubscribe("onGameStarted", this.startSpawning.bind(this));
            this.scene.eventManager.unsubscribe("onGameFinished", this.stopSpawning.bind(this));
        }
    }

    private startSpawning(): void {
        this._intervalId = setInterval((): void => {
            const randomPosition: B.Vector3 = new B.Vector3(Utils.randomInt(-7.5, 7.5), 25, 18);
            const fallingObjectEntity: Entity = this._spawnFallingObject(randomPosition);
            this.scene.entityManager.addEntity(fallingObjectEntity);
        }, 1000);
    }

    private _spawnFallingObject(position: B.Vector3): Entity {
        const randomNumber: number = Utils.randomInt(0, 1);
        if (randomNumber === 0) {
            return this._createRock(position);
        }
        else {
            return this._createLog(position);
        }
    }

    private _createRock(position: B.Vector3): Entity {
        const fallingObjectEntity: Entity = new Entity("fallingObject");

        const fallingObjectMesh: B.Mesh = B.MeshBuilder.CreateSphere("FallingObject", { diameter: 1 }, this.scene.babylonScene);
        fallingObjectMesh.position = position;
        fallingObjectMesh.metadata = { tag: fallingObjectEntity.tag, id: fallingObjectEntity.id };

        fallingObjectEntity.addComponent(new MeshComponent(fallingObjectEntity, this.scene, { mesh: fallingObjectMesh }));
        fallingObjectEntity.addComponent(new FallingObjectBehaviour(fallingObjectEntity, this.scene));
        fallingObjectEntity.addComponent(new RigidBodyComponent(fallingObjectEntity, this.scene, {
            physicsShape: B.PhysicsImpostor.SphereImpostor,
            physicsProps: { mass: 1, restitution: 0.5 }
        }));

        return fallingObjectEntity;
    }

    private _createLog(position: B.Vector3): Entity {
        const logEntity: Entity = new Entity("fallingObject");
    
        const logMesh: B.Mesh = B.MeshBuilder.CreateCylinder("FallingObject", { height: 2, diameter: 1 }, this.scene.babylonScene);
        logMesh.position = position;
        logMesh.metadata = { tag: logEntity.tag, id: logEntity.id };
    
        // Rotation aléatoire 
        const randomRotation = Math.random() * Math.PI * 2; 
        const randomOrientation = Math.random() > 0.1; 
    
        if (randomOrientation) {
            logMesh.rotation.z = randomRotation; // horizontalité parallele au joueur 
        } else {
            logMesh.rotation.y = randomRotation; // verticalité
        }
    
        logEntity.addComponent(new MeshComponent(logEntity, this.scene, { mesh: logMesh }));
        logEntity.addComponent(new FallingObjectBehaviour(logEntity, this.scene));
        logEntity.addComponent(new RigidBodyComponent(logEntity, this.scene, {
            physicsShape: B.PhysicsImpostor.BoxImpostor,
            physicsProps: { mass: 1, restitution: 0.5 }
        }));
    
        return logEntity;
    }
    

    private stopSpawning(): void {
        clearInterval(this._intervalId);

        // destroy all falling objects
        const fallingObjects: Entity[] = this.scene.entityManager.getEntitiesByTag("fallingObject");
        fallingObjects.forEach((fallingObject: Entity): void => {
            this.scene.entityManager.removeEntity(fallingObject);
        });
    }
}