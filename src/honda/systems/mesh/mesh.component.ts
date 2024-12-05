import { Component } from "@/honda/ecs";
import { Material } from "@/honda/gpu/material/material";
import { Mesh } from "@/honda/gpu/meshes/mesh";

export class MeshComponent extends Component {
    public constructor(public mesh: Mesh, public material: Material) {
        super();
    }
}
