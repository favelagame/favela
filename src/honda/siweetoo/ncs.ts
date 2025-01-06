/* eslint-disable class-methods-use-this */
// NodeComponentSystem
//TODO: refactor to ECS at some point

import { nn } from "../util";
import { SceneNode } from "./scene";

export class NCS {
    private _systems: System[] = [];

    public addSystem(system: System) {
        this._systems.push(system);
    }

    public registerComponent(node: SceneNode, component: IComponent) {
        for (const sys of this._systems) {
            if (component instanceof sys.componentType) {
                sys.componentCreated(node, component);
            }
        }
    }

    public destroyComponent(node: SceneNode, component: IComponent) {
        for (const sys of this._systems) {
            if (component instanceof sys.componentType) {
                sys.componentDestroyed(node, component);
            }
        }
    }

    public earlyUpdate() {
        this._systems.forEach((x) => x.earlyUpdate());
    }

    public update() {
        this._systems.forEach((x) => x.update());
    }

    public getSystem<T extends System>(
        sysctor: new (...args: unknown[]) => T
    ): T {
        return nn(this._systems.find((x) => x instanceof sysctor)) as T;
    }
}

export abstract class System {
    public abstract componentType: new (...args: unknown[]) => IComponent;

    public earlyUpdate() {}
    public update() {}

    public abstract componentCreated(
        node: SceneNode,
        component: IComponent
    ): void;
    public abstract componentDestroyed(
        node: SceneNode,
        component: IComponent
    ): void;
}

export interface IComponent {
    name: string | undefined;
    destroy?(): void;
}
