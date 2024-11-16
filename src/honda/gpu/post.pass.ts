import { CameraSystem } from "../core";
import { Game } from "../state";
import { makeStructuredView } from "webgpu-utils";

function mode() {
    const map = Game.input.btnMap;
    if (map["KeyB"]) return 1; // wdepth
    return 0;
}

export class PostprocessPass {
    protected settings = makeStructuredView(
        Game.gpu.shaderModules.favelapost.defs.structs["PostCfg"]
    );

    protected settingsGpuBuffer: GPUBuffer;
    protected bindGroup: GPUBindGroup;

    constructor() {
        this.settingsGpuBuffer = Game.gpu.device.createBuffer({
            size: this.settings.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bindGroup = Game.gpu.device.createBindGroup({
            layout: Game.gpu.pipelines.post.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.settingsGpuBuffer,
                    },
                },
                {
                    binding: 1,
                    resource: Game.gpu.renderTextureView,
                },
                {
                    binding: 2,
                    resource: Game.gpu.depthTextureView,
                },
            ],
        });
    }

    apply() {
        if (Game.gpu.wasResized) {
            this.bindGroup = Game.gpu.device.createBindGroup({
                layout: Game.gpu.pipelines.post.getBindGroupLayout(0),
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.settingsGpuBuffer,
                        },
                    },
                    {
                        binding: 1,
                        resource: Game.gpu.renderTextureView,
                    },
                    {
                        binding: 2,
                        resource: Game.gpu.depthTextureView,
                    },
                ],
            });
        }

        this.settings.set({
            mode: mode(),
            inverseProjection:
                Game.ecs.getSystem(CameraSystem).activeCamera.invMatrix,
            fogStart: 1,
            fogEnd: 100,
            fogDensity: 1,
            fogColor: [1, 0, 1],
        });

        const post = Game.cmdEncoder.beginRenderPass({
            label: "post",
            colorAttachments: [
                {
                    view: Game.gpu.canvasTextureView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: [1, 0, 1, 1],
                },
            ],
        });

        post.setPipeline(Game.gpu.pipelines.post);
        Game.gpu.device.queue.writeBuffer(
            this.settingsGpuBuffer,
            0,
            this.settings.arrayBuffer
        );
        post.setBindGroup(0, this.bindGroup);
        post.draw(3);
        post.end();
    }
}
