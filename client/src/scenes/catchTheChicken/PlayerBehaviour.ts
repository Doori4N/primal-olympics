import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import {InputStates} from "../../core/types";
import * as B from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import {MeshComponent} from "../../components/MeshComponent";

export class PlayerBehaviour implements IComponent {
    public name: string = "PlayerBehaviour";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private mesh!: B.AbstractMesh;

    // animations
    private animations: {[key: string]: B.AnimationGroup} = {};

    // inputs
    public readonly inputIndex!: number;
    private inputStates!: InputStates;
    private isButtonDown: boolean = false;

    // states
    public isStopped: boolean = false;
    private isGameStarted: boolean = false;
    private isGameFinished: boolean = false;

    // velocity
    private velocityX: number = 0;
    private slowDown: number = 0.00005;
    private speed: number = 0.0008;

    // gui
    private gui!: GUI.AdvancedDynamicTexture;
    private slider!: GUI.Slider;
    private orangeThreshold: number = 0.5;
    private redThreshold: number = 0.7;

    constructor(entity: Entity, scene: Scene, props: {inputIndex: number, animationGroups: B.AnimationGroup[]}) {
        this.entity = entity;
        this.scene = scene;
        this.inputIndex = props.inputIndex;
        this.animations["Idle"] = props.animationGroups[0];
        this.animations["Walking"] = props.animationGroups[2];
    }

    public onStart(): void {
        this.inputStates = this.scene.game.inputs.inputMap[this.inputIndex];
        const meshComponent = this.entity.getComponent("Mesh") as MeshComponent;
        this.mesh = meshComponent.mesh;
        this.animations["Idle"].start(true, 1.0, this.animations["Idle"].from, this.animations["Idle"].to, false);
        this.scene.eventManager.subscribe("onGameStarted", this.onGameStarted.bind(this));
        this.scene.eventManager.subscribe("onGameFinished", this.onGameFinished.bind(this));
    }

    public onUpdate(): void {
        this.animate();

        if (!this.isGameStarted || this.isGameFinished || this.isStopped) return;

        // change velocity
        this.applyAcceleration();
        this.applySlowDown();

        // update velocity GUI
        this.updateVelocityGUI(this.velocityX);

        // apply velocity
        this.mesh.position.x += this.velocityX * this.scene.scene.deltaTime;
    }

    public onDestroy(): void {}

    private createVelocityGUI(): void {
        this.gui = GUI.AdvancedDynamicTexture.CreateFullscreenUI(`velocityUI${this.inputIndex}`, true, this.scene.scene);
        this.slider = new GUI.Slider();
        this.slider.minimum = 0;
        this.slider.maximum = 0.03;
        this.slider.value = 0;
        this.slider.height = "15px";
        this.slider.width = "40px";
        this.slider.background = "black";
        this.slider.color = "green";
        this.slider.isThumbClamped = false;
        this.slider.displayThumb = false;
        this.gui.addControl(this.slider);
        this.slider.linkWithMesh(this.mesh);
        this.slider.linkOffsetY = -70;
    }

    private updateVelocityGUI(velocityX: number): void {
        this.slider.value = velocityX;
        if (velocityX / this.slider.maximum > this.redThreshold) {
            this.slider.color = "red";
        }
        else if (velocityX / this.slider.maximum > this.orangeThreshold) {
            this.slider.color = "orange";
        }
        else {
            this.slider.color = "green";
        }
    }

    private removeVelocityGUI(): void {
        this.gui.dispose();
    }

    private applySlowDown(): void {
        if (this.velocityX >= this.slowDown) {
            this.velocityX -= this.slowDown;
        }
        else {
            this.velocityX = 0;
        }
    }

    private applyAcceleration(): void {
        // reset the button state so the player can accelerate again
        if (!this.inputStates.buttons["jump"]) {
            this.isButtonDown = false;
        }

        // the player needs to release the button and press it again to accelerate
        if (this.inputStates.buttons["jump"] && !this.isButtonDown) {
            this.velocityX += this.speed;
            this.isButtonDown = true;
        }
    }

    private onGameStarted(): void {
        this.isGameStarted = true;
        this.createVelocityGUI();
    }

    private onGameFinished(): void {
        this.isGameFinished = true;
        this.removeVelocityGUI();
    }

    public stopPlayer(): void {
        this.isStopped = true;
        this.removeVelocityGUI();
    }

    private animate(): void {
        if (this.velocityX > 0 && !this.animations["Walking"].isPlaying) {
            this.animations["Idle"].stop();
            this.animations["Walking"].start(true, 1.0, this.animations["Walking"].from, this.animations["Walking"].to, false);
        }
        else if (this.velocityX === 0 && !this.animations["Idle"].isPlaying) {
            this.animations["Walking"].stop();
            this.animations["Idle"].start(true, 1.0, this.animations["Idle"].from, this.animations["Idle"].to, false);
        }
    }
}
