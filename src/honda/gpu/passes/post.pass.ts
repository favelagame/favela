import { Game } from "../../state";
import { makeStructuredView } from "webgpu-utils";
import { IPass } from "./pass.interface";
import { CameraSystem } from "@/honda/systems/camera";

function mode() {
    const map = Game.input.btnMap;
    if (map["KeyB"]) return 1; // wdepth
    if (map["KeyN"]) return 2; // normal
    if (map["KeyM"]) return 3; // normal
    return 0;
}

export class PostprocessPass implements IPass {
    protected settings = makeStructuredView(
        Game.gpu.shaderModules.postprocess.defs.structs["PostCfg"]
    );

    protected settingsGpuBuffer: GPUBuffer;
    protected bindGroup!: GPUBindGroup;

    protected guiSettings = {
        fogStart: 0,
        fogEnd: 100,
        fogDensity: 0.47,
        fogColor: [0, 0, 0],

        occlusionPower: 1.6,
        exposure: 0.5,
        gamma: 1.7,

        bloom: 0.07
    };

    constructor() {
        const p = Game.gui.addFolder("Postprocess");
        p.add(this.guiSettings, "fogStart", 0, 100);
        p.add(this.guiSettings, "fogEnd", 0, 100);
        p.add(this.guiSettings, "fogDensity", 0, 5);
        p.addColor(this.guiSettings, "fogColor");
        p.add(this.guiSettings, "occlusionPower", 0, 5);
        p.add(this.guiSettings, "exposure", 0, 5);
        p.add(this.guiSettings, "gamma", 0.01, 5);
        p.add(this.guiSettings, "bloom", 0, 1);

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
                {
                    binding: 4,
                    resource: Game.gpu.textures.bloom.views[0],
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

            inverseProjection: csys.activeCamera.projMtxInv,
            camera: csys.viewMtx,

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
            timestampWrites: Game.gpu.timestamp("post"),
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
