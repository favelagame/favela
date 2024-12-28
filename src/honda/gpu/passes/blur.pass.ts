import { Game } from "@/honda/state";
import { IPass } from "./pass.interface";
import { setTypedValues } from "webgpu-utils";
import { ViewportPingPongTexture } from "../textures/viewportPingPong";

const ALIGNED_UNIFORM_SIZE = 1280;

function halfGauss(n: number) {
    if (n <= 0) return [[1, 1, 1, 1]];

    const sigma = n / 2;
    const factor = 1 / (Math.sqrt(2 * Math.PI) * sigma);

    const kernel = [...Array(n + 1)].map(
        (_, x) => factor * Math.exp((-x * x) / (2 * sigma * sigma))
    );
    const sum = kernel.reduce((acc, v, i) => acc + (i === 0 ? v : 2 * v), 0);
    return kernel.map((v) => [v / sum, v / sum, v / sum, v / sum]).reverse();
}

export class BlurPass implements IPass {
    protected buffer = new ArrayBuffer(2 * ALIGNED_UNIFORM_SIZE);
    protected gpuBuffer: GPUBuffer;
    protected bindGroup!: [GPUBindGroup, GPUBindGroup];

    protected updateBindGroup() {
        const common = [
            {
                binding: 0,
                resource: {
                    buffer: this.gpuBuffer,
                    size: ALIGNED_UNIFORM_SIZE,
                },
            },
            {
                binding: 2,
                resource: Game.gpu.getSampler({
                    addressModeU: "clamp-to-edge",
                    addressModeV: "clamp-to-edge",
                    magFilter: "linear",
                    minFilter: "linear",
                }),
            },
        ];

        this.bindGroup = [
            Game.gpu.device.createBindGroup({
                label: this.label + "A",
                layout: Game.gpu.bindGroupLayouts.blur,
                entries: [
                    ...common,

                    {
                        binding: 1,
                        resource: this.texture.views[0],
                    },
                ],
            }),
            Game.gpu.device.createBindGroup({
                label: this.label + "B",
                layout: Game.gpu.bindGroupLayouts.blur,
                entries: [
                    ...common,
                    {
                        binding: 1,
                        resource: this.texture.views[1],
                    },
                ],
            }),
        ];

        this.setUniforms();
    }

    protected setUniforms() {
        const krnl = halfGauss(this.radius);

        setTypedValues(
            Game.gpu.shaderModules.blur1d.defs.structs["BlurUniforms"],
            {
                v: [1 / this.texture.tex.width, 0],
                size: this.radius,
                krnl,
            },
            this.buffer,
            0
        );
        setTypedValues(
            Game.gpu.shaderModules.blur1d.defs.structs["BlurUniforms"],
            {
                v: [0, 1 / this.texture.tex.height],
                size: this.radius,
                krnl,
            },
            this.buffer,
            ALIGNED_UNIFORM_SIZE
        );

        Game.gpu.device.queue.writeBuffer(this.gpuBuffer, 0, this.buffer);
    }

    public constructor(
        protected texture: ViewportPingPongTexture<GPUTextureFormat>,
        protected pipeline: GPURenderPipeline,
        protected radius = 7,
        protected label = "<blur:unk>"
    ) {
        this.gpuBuffer = Game.gpu.device.createBuffer({
            label,
            size: this.buffer.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
    }

    blurAxis(dir: boolean) {
        const rp = Game.cmdEncoder.beginRenderPass({
            label: `blur${dir ? "x" : "y"}`,
            colorAttachments: [
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: this.texture.views[dir ? 1 : 0],
                },
            ],
            timestampWrites: Game.gpu.timestamp("blur"),
        });
        rp.setPipeline(this.pipeline);
        rp.setBindGroup(0, this.bindGroup[dir ? 0 : 1], [
            dir ? 0 : ALIGNED_UNIFORM_SIZE,
        ]);
        rp.draw(3);

        rp.end();
    }

    apply(): void {
        if (Game.gpu.wasResized || !this.bindGroup) this.updateBindGroup();

        this.blurAxis(true);
        this.blurAxis(false);
    }
}
