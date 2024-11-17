import { vec3 } from "wgpu-matrix";
import { CameraSystem } from "../../core";
import { Game } from "../../state";
import { makeStructuredView } from "webgpu-utils";

function mode() {
    const map = Game.input.btnMap;
    if (map["KeyB"]) return 1; // wdepth
    if (map["KeyN"]) return 2; // normal
    if (map["KeyM"]) return 3; // normal
    return 0;
}

export class PostprocessPass {
    protected settings = makeStructuredView(
        Game.gpu.shaderModules.postprocess.defs.structs["PostCfg"]
    );

    protected settingsGpuBuffer: GPUBuffer;
    protected bindGroup!: GPUBindGroup;

    protected sunDir = vec3.normalize(vec3.create(1, 1, 1));

    protected guiSettings = {
        fogStart: 0,
        fogEnd: 3,
        fogDensity: 0.01,
        fogColor: [0.6, 0.6, 0.6],

        ambientRatio: 0.3,
        occlusionPower: 1,
    };

    constructor() {
        const p = Game.gui.addFolder("Postprocess");
        const f = p.addFolder("Fog");
        f.add(this.guiSettings, "fogStart", 0, 100);
        f.add(this.guiSettings, "fogEnd", 0, 100);
        f.add(this.guiSettings, "fogDensity", 0, 5);
        f.addColor(this.guiSettings, "fogColor");

        const b = p.addFolder("Shading");
        b.add(this.guiSettings, 'ambientRatio', 0, 1);
        b.add(this.guiSettings, 'occlusionPower', 0.5, 5);

        this.settingsGpuBuffer = Game.gpu.device.createBuffer({
            size: this.settings.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    protected createBindGroup() {
        this.bindGroup = Game.gpu.device.createBindGroup({
            label: "postbg",
            layout: Game.gpu.bindGroupLayouts.post,
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
                {
                    binding: 5,
                    resource: Game.gpu.ssaoTextureView,
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
            ...this.guiSettings,
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
