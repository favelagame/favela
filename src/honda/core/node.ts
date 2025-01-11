import { mat4 } from "wgpu-matrix";
import { Game } from "../state";
import { IComponent } from "./ecs";
import { Transform } from "./transform";
import { nn } from "../util";

export class SceneNode {
    public name: string = "<unnammed>";
    public transform = new Transform();
    public children = new Set<SceneNode>();
    public parent?: SceneNode = undefined;
    public dynamic = true;
    public components: IComponent[] = [];

    protected _mat = mat4.create();

    public addChild(c: SceneNode) {
        if (c.parent) {
            console.warn(
                "replacing parent of",
                c,
                "from",
                c.parent,
                "to",
                this
            );
            c.parent.removeChild(c);
        }

        c.parent = this;
        this.children.add(c);
    }

    public removeChild(c: SceneNode) {
        if (this.children.delete(c)) {
            c.parent = undefined;
        } else {
            // the show must go on
            console.warn("attempt to remove non-child", c, "from", this);
        }
        return c;
    }

    public addComponent<T extends IComponent>(c: T) {
        Game.ecs.registerComponent(this, c);
        this.components.push(c);
    }

    // Destroys self and all remaining children
    public destroy() {
        // help out GC by removing all possible references
        this.parent?.removeChild(this);
        this.children.forEach((x) => x.destroy());
        this.children.clear();
        this.components.forEach((x) => x.destroy?.());
        this.components.length = 0;
    }

    public tree(l = 0): string {
        return [
            `${" ┃".repeat(Math.max(l - 1, 0))}${l ? " ┣" : ""} N:${this.name}`,
            ...this.components.map((x) => `${" ┃".repeat(l)} ┠${x.name}`),
            ...(this.components.length && this.children.size
                ? [" ┃".repeat(l + 1)]
                : []),
            ...this.children.values().map((x) => x.tree(l + 1)),
            " ┃".repeat(l),
        ].join("\n");
    }

    public assertComponent<T extends IComponent>(
        ctor: new (...args: never) => T
    ): T {
        return nn(
            this.components.find((x) => x instanceof ctor),
            "component isn't"
        ) as T;
    }

    public assertChildComponent<T extends IComponent>(
        ctor: new (...args: never) => T,
        maxDepth: 127
    ): T {
        return nn(
            this.findChild(
                (x) => x.children.values().some((y) => y instanceof ctor),
                maxDepth
            )?.components.find((y) => y instanceof ctor),
            "child isn't"
        ) as T;
    }

    public assertChildWithName(name: string, maxDepth: 127) {
        return nn(
            this.findChild((x) => x.name == name, maxDepth),
            "child isn't"
        );
    }

    /**
     * Uoooh 😭💢
     * btw this is breath first first, depth first second
     */
    public findChild(
        cond: (child: SceneNode) => boolean,
        maxDepth = 127
    ): SceneNode | undefined {
        const direct = this.children.values().find(cond);
        if (direct) return direct;

        if (maxDepth <= 1) return undefined;

        for (const child of this.children) {
            const f = child.findChild(cond, maxDepth - 1);
            if (f) return f;
        }
        return undefined;
    }
}
