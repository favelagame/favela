import { Component } from "../ecs";
import { mat4, quat, vec3 } from "wgpu-matrix";

export class CTransform extends Component {
    public updateMatrix() {
        mat4.identity(this.matrix);
        mat4.scale(this.matrix, this.scale, this.matrix);
        mat4.multiply(this.matrix, mat4.fromQuat(this.rotation), this.matrix);
        mat4.translate(this.matrix, this.translation, this.matrix);
    }

    public get transform() {
        return this.matrix;
    }

    public translation = vec3.create();
    public rotation = quat.create();
    public scale = vec3.create(1, 1, 1);

    protected matrix = mat4.identity();
}
