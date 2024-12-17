import { CameraSystem, LightSystem } from "../../core";
import { Game } from "../../state";
import { makeStructuredView } from "webgpu-utils";
import { IPass } from "./pass.interface";

export class ShadePass implements IPass {
    protected settings = makeStructuredView(
        Game.gpu.shaderModules.shade.defs.structs["ShadeUniforms"]
    );

    protected uniforms: GPUBuffer;
    protected bindGroup!: GPUBindGroup;

    constructor() {
        this.uniforms = Game.gpu.device.createBuffer({
            size: this.settings.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    protected createBindGroup() {
        this.bindGroup = Game.gpu.device.createBindGroup({
            label: "shadebg",
            layout: Game.gpu.bindGroupLayouts.shade,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniforms,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: Game.ecs.getSystem(LightSystem).lightsBuf,
                    },
                },

                {
                    binding: 2,
                    resource: Game.gpu.textures.base.view,
                },
                {
                    binding: 3,
                    resource: Game.gpu.textures.normal.view,
                },
                {
                    binding: 4,
                    resource: Game.gpu.textures.mtlRgh.view,
                },
                {
                    binding: 5,
                    resource: Game.gpu.textures.emission.view,
                },
                {
                    binding: 6,
                    resource: Game.gpu.textures.depth.view,
                },
                {
                    binding: 7,
                    resource: Game.gpu.getSampler({
                        addressModeU: "clamp-to-edge",
                        addressModeV: "clamp-to-edge",
                        magFilter: "linear",
                        minFilter: "linear",
                    }),
                },
                {
                    binding: 8,
                    resource: Game.gpu.shadowmaps.view,
                },
                {
                    binding: 9,
                    resource: Game.gpu.device.createSampler({
                        compare: "less",
                        minFilter: "linear",
                        magFilter: "linear",
                        label: "shadowSampler",
                    }),
                },
            ],
        });
    }

    apply() {
        if (!this.bindGroup || Game.gpu.wasResized) {
            this.createBindGroup();
        }

        const csys = Game.ecs.getSystem(CameraSystem);
        this.settings.set({
            VPInv: csys.viewProjMtxInv,
            camera: csys.viewMtx,
            nLights: Game.ecs.getSystem(LightSystem).nLights,
        });

        const pass = Game.cmdEncoder.beginRenderPass({
            label: "shade",
            colorAttachments: [
                {
                    view: Game.gpu.textures.shaded.view,
                    loadOp: "load",
                    storeOp: "store",
                },
            ],
            timestampWrites: Game.gpu.timestamp("shade"),
        });

        pass.setPipeline(Game.gpu.pipelines.shade);
        Game.gpu.device.queue.writeBuffer(
            this.uniforms,
            0,
            this.settings.arrayBuffer
        );
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(3);
        pass.end();
    }
}
