import { Game } from "@/honda/state";
import { IPass } from "./pass.interface";
import { LightSystem, MeshSystem } from "@/honda/core";

export class ShadowMapPass implements IPass {
    private mtxBindGroup: GPUBindGroup;

    constructor() {
        const mBuf = Game.ecs.getSystem(LightSystem).shadowmapMatrices;
        const iBuf = Game.ecs.getSystem(MeshSystem).instanceBuffer;

        this.mtxBindGroup = Game.gpu.device.createBindGroup({
            label: "shadowmapBG",
            layout: Game.gpu.bindGroupLayouts.shadow,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: mBuf,
                        size: 64,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: iBuf,
                    },
                },
            ],
        });
    }

    apply(): void {
        const lsys = Game.ecs.getSystem(LightSystem);
        const msys = Game.ecs.getSystem(MeshSystem);

        for (let i = 0; i < lsys.nShadowmaps; i++) {
            const rp = Game.cmdEncoder.beginRenderPass({
                label: `shadowmap:${i}`,
                colorAttachments: [],
                depthStencilAttachment: {
                    view: Game.gpu.shadowmaps.views[i],
                    depthClearValue: 1,
                    depthLoadOp: "clear",
                    depthStoreOp: "store",
                },
                timestampWrites: Game.gpu.timestamp(`shadowmaps`),
            });

            rp.setPipeline(Game.gpu.pipelines.shadow);
            rp.setBindGroup(0, this.mtxBindGroup, [i * lsys.matrixAlignedSize]);

            for (const c of msys.calls) {
                rp.setVertexBuffer(0, c.mesh.position);
                rp.setVertexBuffer(1, c.mesh.texCoord);
                rp.setIndexBuffer(c.mesh.index, "uint16");

                //TODO(mbabnik): alpha clipping in shadows?
                // fries you know where
                rp.drawIndexed(
                    c.mesh.drawCount,
                    c.nInstances,
                    0,
                    0,
                    c.firstInstance
                );
            }

            rp.end();
        }
    }
}
