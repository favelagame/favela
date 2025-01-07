import { nn } from "../util";
import { SceneNode } from "./scene";

/* eslint-disable class-methods-use-this */
export class ECS {
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

    public lateUpdate() {
        this._systems.forEach((x) => x.lateUpdate());
    }

    public getSystem<T extends System>(
        sysctor: new (...args: never[]) => T
    ): T {
        return nn(this._systems.find((x) => x instanceof sysctor)) as T;
    }
}

export abstract class System {
    public abstract componentType: new (...args: never[]) => IComponent;

    public earlyUpdate() {}
    public update() {}
    public lateUpdate() {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public componentCreated(_node: SceneNode, _component: IComponent): void {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public componentDestroyed(_node: SceneNode, _component: IComponent): void {}
}

export interface IComponent {
    name: string | undefined;
    destroy?(): void;
}
