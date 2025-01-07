import { Material, Mesh } from "@/honda";
import { IComponent } from "@/honda/core/ecs";

export class MeshComponent implements IComponent {
    constructor(
        public primitive: Mesh,
        public material: Material,
        public name: string = `unknownMeshComponent`
    ) {}
}
