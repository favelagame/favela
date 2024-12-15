import "reflect-metadata";
import { Component, EcsInjectable } from "@/honda/ecs";
import { Mat4, mat4, quat, vec3 } from "wgpu-matrix";

@EcsInjectable()
export class TransformComponent extends Component {
    public matrix: Mat4;
    public invMatrix: Mat4;

    constructor(
        public translation = vec3.create(),
        public rotation = quat.identity(),
        public scale = vec3.create(1, 1, 1)
    ) {
        super();
        this.matrix = mat4.identity();
        this.invMatrix = mat4.identity();
        this.updateMatrix();
    }

    public updateMatrix() {
        mat4.identity(this.matrix);
        mat4.translate(this.matrix, this.translation, this.matrix);
        mat4.multiply(this.matrix, mat4.fromQuat(this.rotation), this.matrix);
        mat4.scale(this.matrix, this.scale, this.matrix);

        mat4.inverse(this.matrix, this.invMatrix);
        // mat4.identity(this.invMatrix);
        // mat4.scale(this.invMatrix, vec3.inverse(this.scale), this.invMatrix);
        // mat4.multiply(this.invMatrix, mat4.fromQuat(quat.inverse(this.rotation)), this.invMatrix);
        // mat4.translate(this.invMatrix, vec3.negate(this.translation), this.invMatrix);
    }
}
