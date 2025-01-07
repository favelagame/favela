import { mat4, Mat4, quat, vec3 } from "wgpu-matrix";
import { IComponent } from "./ecs";
import { Game } from "..";

export class Transform {
    private _locMtx: Mat4;
    private _locInvMtx: Mat4;
    public $glbMtx: Mat4;
    public $glbInvMtx: Mat4;

    public dirty = false;

    constructor(
        public translation = vec3.create(),
        public rotation = quat.identity(),
        public scale = vec3.create(1, 1, 1)
    ) {
        this._locMtx = mat4.identity();
        this._locInvMtx = mat4.identity();
        this.$glbMtx = mat4.identity();
        this.$glbInvMtx = mat4.identity();
        this.updateLocal();
    }

    public update() {
        this.dirty = true;
    }

    private _scratch = mat4.create();
    private updateLocal() {
        mat4.identity(this._locMtx);
        mat4.translate(this._locMtx, this.translation, this._locMtx);
        mat4.multiply(
            this._locMtx,
            mat4.fromQuat(this.rotation, this._scratch),
            this._locMtx
        );
        mat4.scale(this._locMtx, this.scale, this._locMtx);

        mat4.inverse(this._locMtx, this._locInvMtx);
        this.dirty = false;
    }

    public $updateGlobal(parent: Transform) {
        if (this.dirty) this.updateLocal();
        mat4.mul(parent.$glbMtx, this._locMtx, this.$glbMtx);
        mat4.mul(this._locInvMtx, parent.$glbInvMtx, this.$glbInvMtx);
    }

    public get localMatrix() {
        if (this.dirty) this.updateLocal();
        return this._locMtx;
    }

    public get localInvMatrix() {
        if (this.dirty) this.updateLocal();
        return this._locInvMtx;
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
}

function updateTransforms(n: SceneNode) {
    n.children.forEach((x) => {
        x.transform.$updateGlobal(n.transform);
        updateTransforms(x);
    });
}

export class Scene extends SceneNode {
    constructor() {
        super();
        this.name = "Scene";
    }

    public computeTransforms() {
        updateTransforms(this);
    }
}
