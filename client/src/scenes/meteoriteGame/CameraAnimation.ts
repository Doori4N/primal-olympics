import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import * as B from '@babylonjs/core';
import {CameraComponent} from "../../core/components/CameraComponent";

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
        const positionAnim = new B.Animation(
            "cameraPositionAnimation",
            "position.y",
            this.frameRate,
            B.Animation.ANIMATIONTYPE_FLOAT,
            B.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        const positionAnimKeys: {frame: number, value: number}[] = [];
        positionAnimKeys.push({
            frame: 0,
            value: this.camera.position.y
        });
        positionAnimKeys.push({
            frame: 5 * this.frameRate,
            value: this.camera.position.y + 20
        });
        positionAnimKeys.push({
            frame: 7 * this.frameRate,
            value: this.camera.position.y + 20
        });
        positionAnim.setKeys(positionAnimKeys);
        this.camera.animations.push(positionAnim);

        const rotationAnim = new B.Animation(
            "cameraRotationAnimation",
            "rotation.x",
            this.frameRate,
            B.Animation.ANIMATIONTYPE_FLOAT,
            B.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        const rotationAnimKeys: {frame: number, value: number}[] = [];
        rotationAnimKeys.push({
            frame: 0,
            value: 0
        });
        rotationAnimKeys.push({
            frame: 5 * this.frameRate,
            value: Math.PI / 4
        });
        rotationAnimKeys.push({
            frame: 7 * this.frameRate,
            value: Math.PI / 4
        });
        rotationAnim.setKeys(rotationAnimKeys);
        this.camera.animations.push(rotationAnim);
    }

    private onBeginAnimation(): void {
        this.scene.scene.beginAnimation(
            this.camera,
            0,
            7 * this.frameRate,
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