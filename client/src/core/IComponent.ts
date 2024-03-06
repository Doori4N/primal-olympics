import {Entity} from "./Entity";
import {Scene} from "./Scene";

export interface IComponent {
    name: string;
    entity: Entity;
    scene: Scene;

    onStart(): void;
    onUpdate(): void;
    onTickUpdate(): void;
    onDestroy(): void;
}