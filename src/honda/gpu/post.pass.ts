import { Game } from "../state";

export class PostprocessPass {
    // 0 for post processed, 1 for Z buffer
    // this will get expanded one day
    protected settings = new Uint32Array([0]);
    protected settingsGpuBuffer: GPUBuffer;
    protected bindGroup: GPUBindGroup;

    constructor() {
        this.settingsGpuBuffer = Game.gpu.device.createBuffer({
            size: this.settings.byteLength,
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
            this.settings
        );
        post.setBindGroup(0, this.bindGroup);
        post.draw(3);
        post.end();
    }
}
