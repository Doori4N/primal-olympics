import {IComponent} from "../../core/IComponent";
import {Entity} from "../../core/Entity";
import {Scene} from "../../core/Scene";
import * as B from "@babylonjs/core";
import {NetworkHost} from "../NetworkHost";

export class NetworkAnimationComponent implements IComponent {
    public name: string = "NetworkAnimation";
    public entity: Entity;
    public scene: Scene;

    // component properties
    private readonly _animations: {[key: string]: B.AnimationGroup} = {};

    // event listeners
    private _startAnimationListener = this.startAnimation.bind(this);

    constructor(entity: Entity, scene: Scene, props: {animations: {[key: string]: B.AnimationGroup}}) {
        this.entity = entity;
        this.scene = scene;
        this._animations = props.animations;
    }

    public onStart(): void {
        if (this.scene.game.networkInstance.isHost) return;

        this.scene.game.networkInstance.addEventListener(`startAnimation${this.entity.id}`, this._startAnimationListener);
    }

    public onUpdate(): void {}

    public onFixedUpdate(): void {}

    public onDestroy(): void {
        if (this.scene.game.networkInstance.isHost) return;

        this.scene.game.networkInstance.removeEventListener(`startAnimation${this.entity.id}`, this._startAnimationListener);
    }

    public startAnimation(name: string): void {
        const animation: B.AnimationGroup = this._animations[name];
        if (animation.isPlaying) return;

        // stop all other animations
        for (const animationName in this._animations) {
            if (animationName === name) continue;
            const animation: B.AnimationGroup = this._animations[animationName];
            if (animation.isPlaying) animation.stop();
        }

        // start the animation
        animation.start(true, 1.0, animation.from, animation.to, false);

        // send the animation to all clients
        if (this.scene.game.networkInstance.isHost) {
            const networkHost = this.scene.game.networkInstance as NetworkHost;
            networkHost.sendToAllClients(`startAnimation${this.entity.id}`, name);
        }
    }
}