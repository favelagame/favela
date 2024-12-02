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

        occlusionPower: 1,
        exposure: 1,
    };

    constructor() {
        const p = Game.gui.addFolder("Postprocess");
        p.add(this.guiSettings, "fogStart", 0, 100);
        p.add(this.guiSettings, "fogEnd", 0, 100);
        p.add(this.guiSettings, "fogDensity", 0, 5);
        p.addColor(this.guiSettings, "fogColor");
        p.add(this.guiSettings, "occlusionPower", 0, 5);
        p.add(this.guiSettings, "exposure", 0, 5);

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
                    resource: Game.gpu.textures.shaded.view,
                },
                {
                    binding: 2,
                    resource: Game.gpu.textures.depth.view,
                },
                {
                    binding: 3,
                    resource: Game.gpu.textures.ssao.view,
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
            mode: mode(),

            sunDir: this.sunDir,

            inverseProjection: csys.activeCamera.invMatrix,
            camera: csys.activeCameraTransfrom.invMatrix,

            ...this.guiSettings,
        });

        const post = Game.cmdEncoder.beginRenderPass({
            label: "post",
            colorAttachments: [
                {
                    view: Game.gpu.canvasView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: [1, 0, 1, 1],
                },
            ],
            timestampWrites: Game.gpu.timestamp("main"),
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
