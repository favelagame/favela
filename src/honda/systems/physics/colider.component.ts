import { IComponent } from "@/honda/core/ecs";
import { SceneNode } from "@/honda/core/node";

export const LAYER_PHYSICS = 1;
export const LAYER_ENEMY = 2;
export const LAYER_INTERACT = 4;
export const LAYER_PICKUP = 8;
export const LAYER_QUERY = 16;

type V3 = [number, number, number];

export interface ICollisonInfo {
    node: SceneNode;
    colider: StaticAABBColider | DynamicAABBColider;
}

export class Colider implements IComponent {
    public collisions = new Map<Colider, ICollisonInfo>();

    constructor(
        public readonly isStatic: boolean,
        public onLayers: number,
        public detectLayers: number,
        public name: string = "unknown"
    ) {}
}

export class StaticAABBColider extends Colider {
    constructor(
        public min: V3,
        public max: V3,
        onLayers: number = LAYER_PHYSICS,
        detectLayers = 0
    ) {
        super(true, onLayers, detectLayers);
    }
}

export class DynamicAABBColider extends Colider {
    public velocity = [0, 0, 0];
    public forces = [0, 0, 0];
    public inverseMass = 2;
    public drag = 8;

    public min: V3 = [0, 0, 0];
    public max: V3 = [0, 0, 0];

    public onFloor = false;

    constructor(
        public position: V3,
        public size: V3,
        onLayers: number,
        detectLayers = 0
    ) {
        super(false, onLayers | LAYER_PHYSICS, detectLayers);
        this.updateBounds();
    }

    public moveBy(dx: number, dy: number, dz: number) {
        this.position[0] += dx;
        this.position[1] += dy;
        this.position[2] += dz;
        this.updateBounds();
    }

    public moveTo(nx: number, ny: number, nz: number) {
        this.position[0] = nx;
        this.position[1] = ny;
        this.position[2] = nz;
        this.updateBounds();
    }

    protected updateBounds() {
        this.min[0] = this.position[0] - this.size[0] / 2;
        this.min[1] = this.position[1] - this.size[1] / 2;
        this.min[2] = this.position[2] - this.size[2] / 2;
        this.max[0] = this.position[0] + this.size[0] / 2;
        this.max[1] = this.position[1] + this.size[1] / 2;
        this.max[2] = this.position[2] + this.size[2] / 2;
    }
}
