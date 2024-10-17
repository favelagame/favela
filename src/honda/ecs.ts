// prevent numbers from being passed as entities
export type Entity = number & { " brand": "ent" };

export abstract class Component {}

export abstract class System {
    public abstract componentsRequired: Set<Function>;

    public abstract update(entities: Set<Entity>): void;

    public ecs!: ECS;
}

export type ComponentClass<T extends Component> = new (...args: any[]) => T;

export class ComponentContainer {
    private map = new Map<Function, Component>();

    public add(component: Component): void {
        this.map.set(component.constructor, component);
    }

    public get<T extends Component>(componentClass: ComponentClass<T>): T {
        return this.map.get(componentClass) as T;
    }

    public has(componentClass: Function): boolean {
        return this.map.has(componentClass);
    }

    public hasAll(componentClasses: Iterable<Function>): boolean {
        for (let cls of componentClasses) {
            if (!this.map.has(cls)) {
                return false;
            }
        }
        return true;
    }

    public delete(componentClass: Function): void {
        this.map.delete(componentClass);
    }
}

export class ECS {
    // Main state
    private entities = new Map<Entity, ComponentContainer>();
    private systems = new Map<System, Set<Entity>>();

    // Bookkeeping for entities.
    private nextEntityID = 0;
    private entitiesToDestroy = new Array<Entity>();

    // API: Entities

    public addEntity(): Entity {
        const entity = this.nextEntityID as Entity;
        this.nextEntityID++;
        this.entities.set(entity, new ComponentContainer());
        return entity;
    }

    /**
     * Marks `entity` for removal. The actual removal happens at the end
     * of the next `update()`. This way we avoid subtle bugs where an
     * Entity is removed mid-`update()`, with some Systems seeing it and
     * others not.
     */
    public removeEntity(entity: Entity): void {
        this.entitiesToDestroy.push(entity);
    }

    // API: Components

    public addComponent(entity: Entity, component: Component): void {
        this.entities.get(entity)!.add(component);
        this.checkE(entity);
    }

    public getComponents(entity: Entity): ComponentContainer {
        return this.entities.get(entity)!;
    }

    public removeComponent(entity: Entity, componentClass: Function): void {
        this.entities.get(entity)!.delete(componentClass);
        this.checkE(entity);
    }

    public addSystem(system: System): void {
        // Checking invariant: systems should not have an empty
        // Components list, or they'll run on every entity. Simply remove
        // or special case this check if you do want a System that runs
        // on everything.
        if (system.componentsRequired.size == 0) {
            console.warn("System not added: empty Components list.");
            console.warn(system);
            return;
        }

        // Give system a reference to the ECS so it can actually do
        // anything.
        system.ecs = this;

        // Save system and set who it should track immediately.
        this.systems.set(system, new Set());
        for (let entity of this.entities.keys()) {
            this.checkES(entity, system);
        }
    }

    /**
     * This is ordinarily called once per tick (e.g., every frame). It
     * updates all Systems, then destroys any Entities that were marked
     * for removal.
     */
    public update(): void {
        // Update all systems. (Later, we'll add a way to specify the
        // update order.)
        for (let [system, entities] of this.systems.entries()) {
            system.update(entities);
        }

        // Remove any entities that were marked for deletion during the
        // update.
        while (this.entitiesToDestroy.length > 0) {
            this.destroyEntity(this.entitiesToDestroy.pop()!);
        }
    }

    private destroyEntity(entity: Entity): void {
        this.entities.delete(entity);
        for (let entities of this.systems.values()) {
            entities.delete(entity); // no-op if doesn't have it
        }
    }

    private checkE(entity: Entity): void {
        for (let system of this.systems.keys()) {
            this.checkES(entity, system);
        }
    }

    private checkES(entity: Entity, system: System): void {
        let have = this.entities.get(entity)!;
        let need = system.componentsRequired;
        if (have.hasAll(need)) {
            // should be in system
            this.systems.get(system)!.add(entity); // no-op if in
        } else {
            // should not be in system
            this.systems.get(system)!.delete(entity); // no-op if out
        }
    }
}
