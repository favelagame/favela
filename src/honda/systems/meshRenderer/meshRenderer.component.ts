import { Component, EcsInjectable } from "@/honda/ecs";
import { GpuMeshV1 } from "@/honda/gpu/mesh";
import { Vec3, vec3 } from "wgpu-matrix";

@EcsInjectable()
export class MeshComponent extends Component {
    public color: Vec3;

    constructor(public mesh: GpuMeshV1, r: number, g: number, b: number) {
        super();
        this.color = vec3.create(r, g, b);
    }
}
