import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import * as B from "@babylonjs/core";
import {NetworkHost} from "../NetworkHost";
import {AnimationOptions} from "../types";

export class NetworkAnimationComponent implements IComponent {
    public name: string = "NetworkAnimation";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private readonly _animations: {[key: string]: B.AnimationGroup} = {};
    private _currentAnimation: B.Nullable<B.AnimationGroup> = null;
    private _transitionSpeed: number = 0.1;

    // event listeners
    private _startAnimationEvent = this.startAnimation.bind(this);

    constructor(entity: Entity, scene: Scene, props: {animations: {[key: string]: B.AnimationGroup}}) {
        this.entity = entity;
        this.scene = scene;
        this._animations = props.animations;
    }

    public onStart(): void {
        if (this.scene.game.networkInstance.isHost) return;

        this.scene.game.networkInstance.addEventListener(`startAnimation${this.entity.id}`, this._startAnimationEvent);
    }

    public onUpdate(): void {
        this._smoothTransition();
    }

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        if (this.scene.game.networkInstance.isHost) return;

        this.scene.game.networkInstance.removeEventListener(`startAnimation${this.entity.id}`, this._startAnimationEvent);
    }

    /**
     * Start an animation on the entity
     */
    public startAnimation(name: string, options?: AnimationOptions): void {
        const animation: B.AnimationGroup = this._animations[name];
        if (animation.isPlaying) return;

        const smoothTransition: boolean = options?.smoothTransition ?? true;
        // transition between animations
        if (smoothTransition) {
            this._transitionSpeed = options?.transitionSpeed ?? 0.1;
            animation.weight = 0;
            this._currentAnimation = animation;
        }
        else {
            animation.weight = 1;
            this.stopAllAnimations();
        }

        // start the animation
        const animationLoop: boolean = options?.loop ?? false;
        const animationFrom: number = options?.from ?? animation.from;
        const animationTo: number = options?.to ?? animation.to;
        const speedRatio: number = options?.speedRatio ?? 1;
        animation.start(animationLoop, speedRatio, animationFrom, animationTo);

        // send the animation name to all clients
        if (this.scene.game.networkInstance.isHost) {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients(`startAnimation${this.entity.id}`, name, options);
        }
    }

    public isPlaying(name: string): boolean {
        return this._animations[name].isPlaying;
    }

    /**
     * Smoothly transition between animations according to the transition speed
     */
    private _smoothTransition(): void {
        if (this._currentAnimation) {
            this._currentAnimation.weight = B.Scalar.Clamp(this._currentAnimation.weight + this._transitionSpeed, 0, 1);

            for (const animationName in this._animations) {
                const animation: B.AnimationGroup = this._animations[animationName];
                if ((animation.name !== this._currentAnimation.name) && animation.isPlaying) {
                    animation.weight = B.Scalar.Clamp(animation.weight - this._transitionSpeed, 0, 1);
                    if (animation.weight === 0) animation.stop();
                }
            }

            if (this._currentAnimation.weight === 1) this._currentAnimation = null;
        }
    }

    public stopAllAnimations(): void {
        for (const animationName in this._animations) {
            const animation: B.AnimationGroup = this._animations[animationName];
            if (animation.isPlaying) animation.stop();
        }
    }
}