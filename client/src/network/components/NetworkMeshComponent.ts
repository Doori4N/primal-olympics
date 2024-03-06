import * as B from '@babylonjs/core';
import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import {NetworkHost} from "../NetworkHost";
import {NetworkClient} from "../NetworkClient";

export class NetworkMeshComponent implements IComponent {
    public name: string = "NetworkMesh";
    public entity: Entity;
    public scene: Scene;

    // component properties
    public mesh!: B.Mesh;

    // event listeners
    private _updateMeshPosition = this._updateMeshPositionClientRpc.bind(this);

    constructor(entity: Entity, scene: Scene, props: {mesh: B.Mesh}) {
        this.entity = entity;
        this.scene = scene;
        this.mesh = props.mesh;
    }

    public onStart(): void {
        if (this.scene.game.networkInstance.isHost) return;

        const networkClient = this.scene.game.networkInstance as NetworkClient;
        networkClient.addEventListener(`meshPosition${this.entity.id}`, this._updateMeshPosition);
    }

    public onUpdate(): void {}

    public onTickUpdate(): void {
        if (!this.scene.game.networkInstance.isHost) return;

        const networkHost = this.scene.game.networkInstance as NetworkHost;
        networkHost.sendToAllClients(`meshPosition${this.entity.id}`, this.mesh.position.x, this.mesh.position.y, this.mesh.position.z);
    }

    public onDestroy(): void {
        if (!this.scene.game.networkInstance.isHost) {
            const networkClient = this.scene.game.networkInstance as NetworkClient;
            networkClient.removeEventListener(`meshPosition${this.entity.id}`, this._updateMeshPosition);
        }

        this.mesh.dispose();
    }

    private _updateMeshPositionClientRpc(x: number, y: number, z: number): void {
        this.mesh.position.x = x;
        this.mesh.position.y = y;
        this.mesh.position.z = z;
    }
}