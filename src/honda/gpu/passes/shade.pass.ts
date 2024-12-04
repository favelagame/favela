import { vec3 } from "wgpu-matrix";
import { CameraSystem } from "../../core";
import { Game } from "../../state";
import { makeStructuredView } from "webgpu-utils";

export class ShadePass {
    protected settings = makeStructuredView(
        Game.gpu.shaderModules.shade.defs.structs["ShadeUniforms"]
    );

    protected uniforms: GPUBuffer;
    protected bindGroup!: GPUBindGroup;

    protected sunDir = vec3.normalize(vec3.create(1, 1, 1));

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
                    resource: Game.gpu.textures.base.view,
                },
                {
                    binding: 2,
                    resource: Game.gpu.textures.normal.view,
                },
                {
                    binding: 3,
                    resource: Game.gpu.textures.mtlRgh.view,
                },
                {
                    binding: 4,
                    resource: Game.gpu.textures.depth.view,
                },
                {
                    binding: 5,
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
        if (!this.bindGroup || Game.gpu.wasResized) {
            this.createBindGroup();
        }

        const csys = Game.ecs.getSystem(CameraSystem);
        this.settings.set({
            sunDir: this.sunDir,
            inverseProjection: csys.activeCamera.invMatrix,
            camera: csys.activeCameraTransfrom.invMatrix,
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
