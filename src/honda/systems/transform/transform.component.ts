import "reflect-metadata";
import { Component, EcsInjectable } from "@/honda/ecs";
import { Mat4, mat4, quat, vec3 } from "wgpu-matrix";

@EcsInjectable()
export class TransformComponent extends Component {
    private _matrix: Mat4;

    constructor(
        public translation = vec3.create(),
        public rotation = quat.create(),
        public scale = vec3.create(1, 1, 1)
    ) {
        super();
        this._matrix = mat4.identity();
        this.updateMatrix();
    }

    public updateMatrix() {
        mat4.identity(this._matrix);
        mat4.translate(this._matrix, this.translation, this._matrix);
        mat4.multiply(this._matrix, mat4.fromQuat(this.rotation), this._matrix);
        mat4.scale(this._matrix, this.scale, this._matrix);
    }

    public get matrix() {
        return this._matrix;
    }
}
