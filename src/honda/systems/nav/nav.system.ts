import { System } from "@/honda/core/ecs";
import { NavMesh } from "@/honda/lib/nav2d";

export class NavSystem extends System {
    public componentType = class {
        public name = "nop";
    };

    protected navmesh?: NavMesh;

    public setNavmesh(navmeshData?: [number, number][][]) {
        if (!navmeshData) {
            this.navmesh = undefined;
            return;
        }

        this.navmesh = new NavMesh(navmeshData, {
            triangulate: false,
        });
    }

    public getPath(from: [number, number], to: [number, number]) {
        return this.navmesh?.findPath(from, to) ?? undefined;
    }
}
