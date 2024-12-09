import { Game } from "@/honda/state";
import { SKYBOX_DRAW_COUNT, SKYBOX_VERTS } from "./skybox.const";
import { CameraSystem } from "@/honda/core";
import { makeStructuredView } from "webgpu-utils";
import { mat4 } from "wgpu-matrix";
import { IPass } from "../pass.interface";

//TODO: move skybox out of ctor 
// (add scene system or make a global object (sth like Game.scene.envmap))

export class SkyPass implements IPass {
    protected sampler: GPUSampler;
    protected uniforms = makeStructuredView(
        Game.gpu.shaderModules.sky.defs.structs["SkyUniforms"]
    );
    protected uniformsBuf: GPUBuffer;
    protected bindGroup!: GPUBindGroup;
    protected verts!: GPUBuffer;

    constructor(protected cubemap: GPUTexture) {
        this.sampler = Game.gpu.getSampler({
            minFilter: "linear",
            magFilter: "linear",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
        });

        this.verts = Game.gpu.device.createBuffer({
            size: SKYBOX_VERTS.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            label: "skyboxVertex",
        });

        this.uniformsBuf = Game.gpu.device.createBuffer({
            size: this.uniforms.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: "skyboxUniforms",
        });

        Game.gpu.device.queue.writeBuffer(this.verts, 0, SKYBOX_VERTS);

        this.bindGroup = Game.gpu.device.createBindGroup({
            label: "skyBG",
            layout: Game.gpu.pipelines.sky.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformsBuf,
                    },
                },
                {
                    binding: 1,
                    resource: Game.gpu.getSampler({
                        addressModeU: "clamp-to-edge",
                        addressModeV: "clamp-to-edge",
                        magFilter: "linear",
                        minFilter: "linear",
                    }),
                },
                {
                    binding: 2,
                    resource: cubemap.createView({
                        dimension: "cube",
                    }),
                },
            ],
        });
    }

    private _viewProjNoTranslation = mat4.create();

    apply(): void {
        const csys = Game.ecs.getSystem(CameraSystem);

        mat4.copy(csys.activeCameraTransfrom.invMatrix, this._viewProjNoTranslation);
        this._viewProjNoTranslation[12] = 0;
        this._viewProjNoTranslation[13] = 0;
        this._viewProjNoTranslation[14] = 0;

        this.uniforms.set({
            view: this._viewProjNoTranslation,
            projection: csys.activeCamera.matrix,
        });

        const post = Game.cmdEncoder.beginRenderPass({
            label: "sky",
            colorAttachments: [
                {
                    view: Game.gpu.textures.shaded.view,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: [0, 0, 0, 1],
                },
            ],
            timestampWrites: Game.gpu.timestamp("sky"),
        });
        
        post.setPipeline(Game.gpu.pipelines.sky);
        Game.gpu.device.queue.writeBuffer(
            this.uniformsBuf,
            0,
            this.uniforms.arrayBuffer
        );
        post.setVertexBuffer(0, this.verts);
        post.setBindGroup(0, this.bindGroup);
        post.draw(SKYBOX_DRAW_COUNT);
        post.end();
    }
}
