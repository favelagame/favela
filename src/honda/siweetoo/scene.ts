import { mat4, Mat4, quat, vec3 } from "wgpu-matrix";
import { IComponent } from "./ncs";
import { Game } from "../core";

export class Transform {
    private _matrix: Mat4;
    private _invMatrix: Mat4;
    public dirty = false;

    constructor(
        public translation = vec3.create(),
        public rotation = quat.identity(),
        public scale = vec3.create(1, 1, 1)
    ) {
        this._matrix = mat4.identity();
        this._invMatrix = mat4.identity();
        this.updateMatrix();
    }

    public update() {
        this.dirty = true;
    }

    private _scratch = mat4.create();
    private updateMatrix() {
        mat4.identity(this._matrix);
        mat4.translate(this._matrix, this.translation, this._matrix);
        mat4.multiply(
            this._matrix,
            mat4.fromQuat(this.rotation, this._scratch),
            this._matrix
        );
        mat4.scale(this._matrix, this.scale, this._matrix);

        mat4.inverse(this._matrix, this._invMatrix);
        this.dirty = false;
    }

    public get matrix() {
        if (this.dirty) this.updateMatrix();
        return this._matrix;
    }

    public get invMatrix() {
        if (this.dirty) this.updateMatrix();
        return this._invMatrix;
    }
}

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
        Game.ncs.registerComponent(this, c);
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
            `${" ".repeat(l * 2)}N:${this.name}`,
            ...this.components.map((x) => `${" ".repeat(l * 2)} ┠${x.name}`),
            "",
            ...this.children.values().map((x) => x.tree(l + 1)),
        ].join("\n");
    }
}

export class Scene extends SceneNode {
    constructor() {
        super();
        this.name = "Scene";
    }
}
