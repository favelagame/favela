import { vec3 } from "wgpu-matrix";
import { CameraSystem } from "../core";
import { Game } from "../state";
import { makeStructuredView } from "webgpu-utils";

function mode() {
    const map = Game.input.btnMap;
    if (map["KeyB"]) return 1; // wdepth
    if (map["KeyN"]) return 2; // normal
    return 0;
}

function generateSampleHemisphere(nSamples: number) {
    const arr = new Float32Array([nSamples * 3]);
    const arr2 = [];

    const cVec = vec3.create();
    for (let i = 1; i < nSamples; i++) {
        cVec[0] = Math.random() * 2 - 1;
        cVec[1] = Math.random() * 2 - 1;
        cVec[2] = Math.random();

        vec3.normalize(cVec, cVec);
        vec3.scale(cVec, Math.pow(i / nSamples, 2), cVec);

        arr[i * 3 + 0] = cVec[0];
        arr[i * 3 + 1] = cVec[1];
        arr[i * 3 + 2] = cVec[2];
        arr2.push(`vector((0,0,0),(${cVec[0]},${cVec[1]},${cVec[2]}))`);
    }
    console.log(arr2.join('\n'))
}

export class PostprocessPass {
    protected settings = makeStructuredView(
        Game.gpu.shaderModules.favelapost.defs.structs["PostCfg"]
    );

    protected settingsGpuBuffer: GPUBuffer;
    protected bindGroup!: GPUBindGroup;

    protected sunDir = vec3.normalize(vec3.create(1, 1, 1));

    constructor() {
        this.settingsGpuBuffer = Game.gpu.device.createBuffer({
            size: this.settings.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.createBindGroup();
        generateSampleHemisphere(64);
    }

    protected createBindGroup() {
        this.bindGroup = Game.gpu.device.createBindGroup({
            label: "postbg",
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
                    resource: Game.gpu.colorTextureView,
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

    apply() {
        if (Game.gpu.wasResized) {
            this.createBindGroup();
        }

        this.settings.set({
            mode: mode(),

            sunDir: this.sunDir,

            inverseProjection:
                Game.ecs.getSystem(CameraSystem).activeCamera.invMatrix,
            fogStart: 0,
            fogEnd: 3,
            fogDensity: 1,
            fogColor: [0.6, 0.6, 0.6],
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
