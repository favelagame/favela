import { SceneNode } from "@/honda/core/node";
import { System } from "../../core/ecs";
import { MeshComponent } from "./mesh.component";
import { Game, Material, Mesh } from "@/honda";

interface IDrawCall {
    mat: Material;
    mesh: Mesh;

    firstInstance: number;
    nInstances: number;
}

export class MeshSystem extends System {
    public componentType = MeshComponent;
    protected instances: Float32Array;
    public instanceBuffer: GPUBuffer;
    public calls = [] as IDrawCall[];

    constructor(maxInstances: number = 4096) {
        super();
        this.instances = new Float32Array(maxInstances * 32);
        this.instanceBuffer = Game.gpu.device.createBuffer({
            label: "MeshInstances",
            size: this.instances.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
        });
    }

    protected components = new Map<MeshComponent, SceneNode>();

    public componentCreated(node: SceneNode, comp: MeshComponent) {
        if (this.components.delete(comp)) {
            console.warn("moved component to new node", comp, node);
        }
        this.components.set(comp, node);
    }

    public componentDestroyed(_: SceneNode, comp: MeshComponent) {
        this.components.delete(comp);
    }

    public lateUpdate(): void {
        const sortedEntities = this.components
            .entries()
            .toArray()
            .sort(([a], [b]) => {
                const dmt = a.material.type - b.material.type;
                if (dmt !== 0) return dmt;
                const dmid = a.material.id - b.material.id;
                if (dmid !== 0) return dmid;
                return a.primitive.id - b.primitive.id;
            });

        this.calls = [];
        if (sortedEntities.length == 0) return;

        let i = 0,
            previousMesh: Mesh = null!,
            previousMat: Material = null!;

        for (const [
            { material: mat, primitive: mesh },
            { transform: tc },
        ] of sortedEntities) {
            this.instances.set(tc.$glbMtx, i * 32);
            this.instances.set(tc.$glbInvMtx, i * 32 + 16);

            if (previousMat != mat || previousMesh != mesh) {
                this.calls.push({
                    firstInstance: i,
                    nInstances: 1,
                    mat,
                    mesh,
                });
                previousMat = mat;
                previousMesh = mesh;
            } else {
                this.calls.at(-1)!.nInstances++;
            }
            i++;
        }

        Game.gpu.device.queue.writeBuffer(
            this.instanceBuffer,
            0,
            this.instances,
            0,
            4 * 32 * i
        );
    }
}
