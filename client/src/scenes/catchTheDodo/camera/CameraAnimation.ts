import {IComponent} from "../../../core/IComponent";
import {Entity} from "../../../core/Entity";
import {Scene} from "../../../core/Scene";
import * as B from '@babylonjs/core';
import {CameraComponent} from "../../../core/components/CameraComponent";

export class CameraAnimation implements IComponent {
    public name: string = "CameraAnimation";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private camera!: B.FreeCamera;
    private frameRate: number = 30;


    constructor(entity: Entity, scene: Scene) {
        this.entity = entity;
        this.scene = scene;
    }

    public onStart(): void {
        const cameraComponent = this.entity.getComponent("Camera") as CameraComponent;
        this.camera = cameraComponent.camera;

        this.scene.scene.switchActiveCamera(this.camera);

        this.initCameraAnimation();

        this.scene.eventManager.subscribe("onPresentationFinished", this.onBeginAnimation.bind(this));
    }

    public onUpdate(): void {}

    public onDestroy(): void {}

    private initCameraAnimation(): void {
        const animation = new B.Animation(
            "cameraAnimation",
            "position",
            this.frameRate,
            B.Animation.ANIMATIONTYPE_VECTOR3,
            B.Animation.ANIMATIONLOOPMODE_CYCLE
        );
        const animationKeys: {frame: number, value: B.Vector3}[] = [];
        animationKeys.push({
            frame: 0,
            value: this.camera.position
        });
        animationKeys.push({
            frame: 8 * this.frameRate,
            value: new B.Vector3(this.camera.position.x, this.camera.position.y, this.camera.position.z - 10)
        });
        animationKeys.push({
            frame: 10 * this.frameRate,
            value: new B.Vector3(this.camera.position.x, this.camera.position.y, this.camera.position.z - 10)
        });
        animation.setKeys(animationKeys);
        this.camera.animations.push(animation);
    }

    private onBeginAnimation(): void {
        this.scene.scene.beginAnimation(
            this.camera,
            0,
            10 * this.frameRate,
            false,
            1,
            this.onEndAnimation.bind(this)
        );
    }

    private onEndAnimation(): void {
        this.scene.eventManager.notify("onCameraAnimationFinished");
        this.scene.entityManager.destroyEntity(this.entity);
    }
}