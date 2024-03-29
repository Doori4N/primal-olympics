import {Entity} from "./Entity";

export class EntityManager {
    private entities: Map<string, Entity>;

    constructor() {
        this.entities = new Map<string, Entity>();
    }

    /**
     * Returns an entity given its id
     * @param id
     * @throws Error if entity is not found
     */
    public getEntityById(id: string): Entity {
        const entity: Entity | undefined = this.entities.get(id);

        if (!entity) {
            throw new Error(`Entity with id ${id} not found!`);
        }

        return entity;
    }

    /**
     * Returns all entities with a given tag
     * @param tag
     */
    public getEntitiesWithTag(tag: string): Entity[] {
        const entitiesWithTag: Entity[] = [];

        this.entities.forEach((entity: Entity): void => {
            if (entity.tag === tag) {
                entitiesWithTag.push(entity);
            }
        });

        return entitiesWithTag;
    }

    /**
     * Returns the first entity with a given tag
     * @throws Error if entity is not found
     */
    public getFirstEntityWithTag(tag: string): Entity {
        for (const entity of this.entities.values()) {
            if (entity.tag === tag) {
                return entity;
            }
        }
        throw new Error(`Entity with tag ${tag} not found!`);
    }

    /**
     * Adds an entity to scene and starts its components
     * @param entity
     */
    public addEntity(entity: Entity): void {
        this.entities.set(entity.id, entity);
        entity.startComponents();
    }

    /**
     * Updates all entities and their components
     */
    public update(): void {
        this.entities.forEach((entity: Entity): void => {
            entity.updateComponents();
        });
    }

    public fixedUpdate(): void {
        this.entities.forEach((entity: Entity): void => {
            entity.fixedUpdateComponents();
        });
    }

    /**
     * Destroys an entity and its components
     * @param entity
     */
    public destroyEntity(entity: Entity): void {
        entity.destroyComponents();
        this.entities.delete(entity.id);
    }

    /**
     * Destroys all entities with a given tag
     * @param tag
     */
    public destroyEntitiesWithTag(tag: string): void {
        this.entities.forEach((entity: Entity): void => {
            if (entity.tag === tag) {
                entity.destroyComponents();
                this.entities.delete(entity.id);
            }
        });
    }

    /**
     * Destroys all entities and their components
     */
    public destroyAllEntities(): void {
        this.entities.forEach((entity: Entity): void => {
            entity.destroyComponents();
        });
        this.entities.clear();
    }
}