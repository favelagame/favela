import "reflect-metadata";
import { Game } from "./state";
type Constructor<T = unknown> = new (...args: never[]) => T;

export type Entity = number;

export abstract class Component {}

export abstract class System {
    public abstract componentsRequired: Set<Constructor>;

    public abstract update(entities: Set<Entity>): void;

    public ecs!: ECS;
}

export type ComponentClass<T extends Component> = new (...args: never[]) => T;

export class ComponentContainer {
    private map = new Map<Constructor, Component>();

    public add(component: Component): void {
        this.map.set(
            component.constructor as Constructor<Component>,
            component
        );
    }

    public get<T extends Component>(componentClass: ComponentClass<T>): T {
        return this.map.get(componentClass) as T;
    }

    public has(componentClass: Constructor): boolean {
        return this.map.has(componentClass);
    }

    public hasAll(componentClasses: Iterable<Constructor>): boolean {
        for (const cls of componentClasses) {
            if (!this.map.has(cls)) {
                return false;
            }
        }
        return true;
    }

    public delete(componentClass: Constructor): void {
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

    public removeComponent(entity: Entity, componentClass: Constructor): void {
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
        for (const entity of this.entities.keys()) {
            this.checkES(entity, system);
        }
    }

    /**
     * Get instance of system
     */
    public getSystem<T extends System>(sysCtor: Constructor<T>): T {
        for (const system of this.systems.keys()) {
            if (system instanceof sysCtor) return system;
        }
        throw new Error("No such system");
    }

    /**
     * This is ordinarily called once per tick (e.g., every frame). It
     * updates all Systems, then destroys any Entities that were marked
     * for removal.
     */
    public update(): void {
        // Update all systems. (Later, we'll add a way to specify the
        // update order.)
        for (const [system, entities] of this.systems.entries()) {
            Game.perf.measure(`update:${(system as any).constructor.name}`);
            system.update(entities);
            Game.perf.measureEnd();
        }

        // Remove any entities that were marked for deletion during the
        // update.
        while (this.entitiesToDestroy.length) {
            this.destroyEntity(this.entitiesToDestroy.pop()!);
        }
    }

    private destroyEntity(entity: Entity): void {
        this.entities.delete(entity);
        for (const entities of this.systems.values()) {
            entities.delete(entity); // no-op if doesn't have it
        }
    }

    public get entityCount() {
        return this.entities.size;
    }

    private checkE(entity: Entity): void {
        for (const system of this.systems.keys()) {
            this.checkES(entity, system);
        }
    }

    private checkES(entity: Entity, system: System): void {
        const have = this.entities.get(entity)!;
        const need = system.componentsRequired;
        if (have.hasAll(need)) {
            // should be in system
            this.systems.get(system)!.add(entity); // no-op if in
        } else {
            // should not be in system
            this.systems.get(system)!.delete(entity); // no-op if out
        }
    }
}

export function EcsInjectable<T extends object>() {
    return (target: T) => {
        Reflect.defineMetadata("injectable", true, target);
    };
}
