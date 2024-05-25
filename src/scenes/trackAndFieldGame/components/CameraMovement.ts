import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from "@babylonjs/core";
import {MeshComponent} from "../../../core/components/MeshComponent";
import {Utils} from "../../../utils/Utils";
import {CameraComponent} from "../../../core/components/CameraComponent";
import {PlayerBehaviour} from "./PlayerBehaviour";

export class CameraMovement implements IComponent {
    public name: string = "CameraMovement";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private _camera!: B.FreeCamera;
    private _cameraSpeed: number = 0.03;
    private _player: Entity;

    constructor(entity: Entity, scene: Scene, props: {player: Entity}) {
        this.entity = entity;
        this.scene = scene;
        this._player = props.player;
    }

    public onStart(): void {
        const cameraComponent = this.entity.getComponent("Camera") as CameraComponent;
        this._camera = cameraComponent.camera;
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {
        const meshComponent = this._player.getComponent("Mesh") as MeshComponent;
        const playerMesh: B.Mesh = meshComponent.mesh;

        this._camera.position.x = Utils.lerp(this._camera.position.x, playerMesh.position.x, this._cameraSpeed);
    }

    public onDestroy(): void {}

    public changePlayerView(): void {
        const currentPlayerBehaviour = this._player.getComponent("PlayerBehaviour") as PlayerBehaviour;
        if (!currentPlayerBehaviour.hasFinished) return;

        const players: Entity[] = this.scene.entityManager.getEntitiesByTag("player");

        let nextPlayer: B.Nullable<Entity> = null;
        for (let i: number = 0; i < players.length; i++) {
            const playerBehaviour = players[i].getComponent("PlayerBehaviour") as PlayerBehaviour;
            if (playerBehaviour.hasFinished) continue;
            nextPlayer = players[i];
        }

        if (nextPlayer) {
            this._player = nextPlayer;
        }
    }
}