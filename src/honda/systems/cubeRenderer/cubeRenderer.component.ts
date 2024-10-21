import { Component, EcsInjectable } from "@/honda/ecs";
import { Vec3, vec3 } from "wgpu-matrix";

@EcsInjectable()
export class CCubeRendererComponent extends Component {
    public color: Vec3;
    constructor(r: number, g: number, b: number) {
        super();
        this.color = vec3.create(r, g, b);
    }
}
