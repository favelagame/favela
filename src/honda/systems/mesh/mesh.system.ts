import { Entity, System } from "@/honda/ecs";
import { TransformComponent } from "../transform";
import { MeshComponent } from "./mesh.component";
import { Game } from "@/honda/state";
import { Material } from "@/honda/gpu/material/material";
import { Mesh } from "@/honda/gpu/meshes/mesh";

interface IDrawCall {
    mat: Material;
    mesh: Mesh;

    firstInstance: number;
    nInstances: number;
}

export class MeshSystem extends System {
    protected instances: Float32Array;
    protected instanceBuffer: GPUBuffer;

    public instanceBindGroup: GPUBindGroup;
    public calls = [] as IDrawCall[];

    constructor(maxInstances: number = 4096) {
        super();
        this.instances = new Float32Array(maxInstances * 32);
        this.instanceBuffer = Game.gpu.device.createBuffer({
            label: "MeshInstances",
            size: this.instances.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
        });

        this.instanceBindGroup = Game.gpu.device.createBindGroup({
            label: "MeshBindGroup",
            layout: Game.gpu.bindGroupLayouts.instance,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.instanceBuffer },
                },
            ],
        });
    }

    public componentsRequired = new Set([TransformComponent, MeshComponent]);

    public update(entities: Set<Entity>): void {
        const sortedEntities = Array.from(entities)
            .map((entity) => {
                const comp = this.ecs.getComponents(entity);
                return {
                    entity,
                    mc: comp.get(MeshComponent),
                    tc: comp.get(TransformComponent),
                };
            })
            .sort((a, b) => {
                const dmt = a.mc.material.type - b.mc.material.type;
                if (dmt !== 0) return dmt;
                const dmid = a.mc.material.id - b.mc.material.id;
                if (dmid !== 0) return dmid;
                return a.mc.mesh.id - b.mc.mesh.id;
            });

        this.calls = [];
        if (sortedEntities.length == 0) return;

        let i = 0,
            previousMesh: Mesh = null!,
            previousMat: Material = null!;

        for (const ent of sortedEntities) {
            const mat = ent.mc.material,
                mesh = ent.mc.mesh;

            this.instances.set(ent.tc.matrix, i * 32);
            this.instances.set(ent.tc.invMatrix, i * 32 + 16);

            if (previousMat != mat || previousMesh != mesh) {
                this.calls.push({
                    firstInstance: i,
                    nInstances: 1,
                    mat: ent.mc.material,
                    mesh: ent.mc.mesh,
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
