import {IComponent} from "./IComponent";
import {v4 as uuid} from "uuid";

export class Entity {
    public id: string;
    public tag: string;
    private components = new Map<string, IComponent>();

    constructor(tag: string = "") {
        this.id = uuid();
        this.tag = tag;
    }

    /**
     * Adds a component to the entity
     * @param component
     * @throws Error if component already exists
     */
    public addComponent(component: IComponent): void {
        if (this.components.has(component.name)) {
            throw new Error(`Component ${component.name} already exists on entity ${this.id}`);
        }
        this.components.set(component.name, component);
    }

    /**
     * Removes a component from the entity
     * @param componentName
     * @throws Error if component does not exist
     */
    public removeComponent(componentName: string): void {
        const component: IComponent = this.getComponent(componentName);
        component.onDestroy();
        this.components.delete(componentName);
    }

    /**
     * Checks if the entity has a component
     * @param componentName
     */
    public hasComponent(componentName: string): boolean {
        return this.components.has(componentName);
    }

    /**
     * Returns the component from the entity
     * @param componentName
     * @throws Error if component does not exist
     */
    public getComponent(componentName: string): IComponent {
        const component: IComponent | undefined = this.components.get(componentName);

        if (!component) {
            throw new Error(`Component ${componentName} does not exist on entity ${this.id}`);
        }

        return component;
    }

    /**
     * Calls the onStart method of all components
     */
    public startComponents(): void {
        this.components.forEach((component: IComponent): void => {
            component.onStart();
        });
    }

    /**
     * Calls the onUpdate method of all components
     */
    public updateComponents(): void {
        this.components.forEach((component: IComponent): void => {
            component.onUpdate();
        });
    }

    /**
     * Calls the onDestroy method of all components
     */
    public destroyComponents(): void {
        this.components.forEach((component: IComponent): void => {
            component.onDestroy();
        });
    }
}