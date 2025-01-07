import { Game } from "@/honda";
import { IPass } from "./pass.interface";
import { makeStructuredView } from "webgpu-utils";
import { BlurPass } from "./blur.pass";

export class BloomPass implements IPass {
    protected settings = makeStructuredView(
        Game.gpu.shaderModules.bloom.defs.structs["BloomUniforms"]
    );

    protected settingsGpuBuffer: GPUBuffer;
    protected bindGroup!: GPUBindGroup;

    protected blur: BlurPass;

    protected guiSettings = {
        threshold: 1,
        knee: 1,
    };

    constructor() {
        const p = Game.gui.addFolder("Bloom");
        p.add(this.guiSettings, "threshold", 1, 32);
        p.add(this.guiSettings, "knee", 1, 32);

        this.settingsGpuBuffer = Game.gpu.device.createBuffer({
            size: this.settings.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.blur = new BlurPass(
            Game.gpu.textures.bloom,
            Game.gpu.pipelines.blurRgbaF16,
            4, //9x9
            "blur-bloom"
        );
    }

    protected createBindGroup() {
        this.bindGroup = Game.gpu.device.createBindGroup({
            label: "bloombg",
            layout: Game.gpu.bindGroupLayouts.bloom,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.settingsGpuBuffer,
                    },
                },
                {
                    binding: 1,
                    resource: Game.gpu.textures.shaded.view,
                },
            ],
        });
    }

    apply() {
        if (!this.bindGroup || Game.gpu.wasResized) {
            this.createBindGroup();
        }

        const post = Game.cmdEncoder.beginRenderPass({
            label: "bloom",
            colorAttachments: [
                {
                    view: Game.gpu.textures.bloom.views[0],
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: [0, 0, 0, 1],
                },
            ],
            timestampWrites: Game.gpu.timestamp("bloom"),
        });

        post.setPipeline(Game.gpu.pipelines.bloom);
        this.settings.set(this.guiSettings);
        Game.gpu.device.queue.writeBuffer(
            this.settingsGpuBuffer,
            0,
            this.settings.arrayBuffer
        );
        post.setBindGroup(0, this.bindGroup);

        post.draw(3);
        post.end();

        // the seperable gaussian blur seems a lil boxy still
        // blur twice to fix this (shoutout Central Limit Theorem)
        this.blur.apply();
        this.blur.apply();
    }
}
