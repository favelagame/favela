import { CameraSystem } from "@/honda/core";
import { Game } from "@/honda/state";
import { makeStructuredView } from "webgpu-utils";
import { vec3 } from "wgpu-matrix";

function generateSampleHemisphere(nSamples: number) {
    const arr = new Float32Array(nSamples * 4);

    const cVec = vec3.create();
    for (let i = 0; i < nSamples; i++) {
        cVec[0] = Math.random() * 2 - 1;
        cVec[1] = Math.random() * 2 - 1;
        cVec[2] = Math.random();

        vec3.normalize(cVec, cVec);
        vec3.scale(cVec, Math.pow((i + 1) / nSamples, 2), cVec);

        arr[i * 4 + 0] = cVec[0];
        arr[i * 4 + 1] = cVec[1];
        arr[i * 4 + 2] = cVec[2];
    }

    return arr;
}

function generateNoise(size: number) {
    const n = size * size;
    const arr = new Float32Array(n * 4);

    for (let i = 0; i < n; i++) {
        arr[i * 4 + 0] = Math.random() * 2 - 1;
        arr[i * 4 + 1] = Math.random() * 2 - 1;
        arr[i * 4 + 2] = 0;
    }
    return arr;
}

export class SSAOPass {
    protected settings = makeStructuredView(
        Game.gpu.shaderModules.ssao.defs.structs["SSAOCfg"]
    );

    protected settingsGpuBuffer: GPUBuffer;
    protected bindGroup!: GPUBindGroup;
    protected noiseTexture: GPUTexture;
    protected noiseTextureView: GPUTextureView;
    protected ssaoSamples = generateSampleHemisphere(64);

    protected guiSettings = {
        kernelSize: 64,
        radius: 0.5,
        bias: 0.025,
    };

    protected createBindGroup() {
        this.bindGroup = Game.gpu.device.createBindGroup({
            label: "ssaobg",
            layout: Game.gpu.bindGroupLayouts.ssao,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.settingsGpuBuffer,
                    },
                },
                {
                    binding: 1,
                    resource: this.noiseTextureView,
                },
                {
                    binding: 2,
                    resource: Game.gpu.normalTextureView,
                },
                {
                    binding: 3,
                    resource: Game.gpu.depthTextureView,
                },
                {
                    binding: 4,
                    resource: Game.gpu.getSampler({
                        addressModeU: "clamp-to-edge",
                        addressModeV: "clamp-to-edge",
                        magFilter: "linear",
                        minFilter: "linear",
                    }),
                },
            ],
        });
    }

    constructor() {
        this.settingsGpuBuffer = Game.gpu.device.createBuffer({
            size: this.settings.arrayBuffer.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
        this.noiseTexture = Game.gpu.device.createTexture({
            format: "rgba32float",
            size: [4, 4, 1],
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
        });
        this.noiseTextureView = this.noiseTexture.createView();

        Game.gpu.device.queue.writeTexture(
            {
                texture: this.noiseTexture,
            },
            generateNoise(4),
            {
                bytesPerRow: 64,
                rowsPerImage: 4,
            },
            [4, 4, 1]
        );

        const p = Game.gui.addFolder("SSAO");
        p.add(this.guiSettings, "kernelSize", 1, 64);
        p.add(this.guiSettings, "radius", 0, 1);
        p.add(this.guiSettings, "bias", 0.0001, 0.1);
    }

    apply() {
        if (Game.gpu.wasResized) {
            this.createBindGroup();
        }

        const cameraSys = Game.ecs.getSystem(CameraSystem);
        const camera = cameraSys.activeCamera
        this.settings.set({
            projection: camera.matrix,
            inverseProjection: camera.invMatrix,
            samples: this.ssaoSamples,
            camera: cameraSys.activeCameraTransfrom.matrix,

            ...this.guiSettings,
        });

        const post = Game.cmdEncoder.beginRenderPass({
            label: "ssao",
            colorAttachments: [
                {
                    view: Game.gpu.ssaoTextureView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: [0, 0, 0, 0],
                },
            ],
        });

        post.setPipeline(Game.gpu.pipelines.ssao);
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
