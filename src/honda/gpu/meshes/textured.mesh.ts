import { Game } from "../../state";
import { TexturedMeshDataV1 } from "../../util/gltf";
import { GpuMeshV1 } from "./basic.mesh";
import { IMesh, MeshType } from "./mesh.interface";

function setupPipeline() {}

export class GpuTexturedMeshV1 extends GpuMeshV1 implements IMesh {
    public bufKey: number;
    public readonly type: MeshType = "basicTextured";
    public readonly setupPipeline = setupPipeline;

    protected texture?: GPUTexture;
    protected sampler?: GPUSampler;
    protected bindGroup?: GPUBindGroup;

    constructor(protected meshData: TexturedMeshDataV1) {
        super(meshData);
        this.bufKey = meshData.id;
    }

    upload(): void {
        super.upload();

        //TODO: prevent creating duplicate textures (cache?)
        this.texture = Game.gpu.device.createTexture({
            format: "rgba8unorm-srgb",
            size: [
                this.meshData.baseTex.image.width,
                this.meshData.baseTex.image.height,
            ],
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });

        Game.gpu.device.queue.copyExternalImageToTexture(
            {
                source: this.meshData.baseTex.image,
            },
            {
                texture: this.texture!,
            },
            [
                this.meshData.baseTex.image.width,
                this.meshData.baseTex.image.height,
                1,
            ]
        );

        this.sampler = Game.gpu.getSampler(
            this.meshData.baseTex.samplerDescriptor
        );

        this.bindGroup = Game.gpu.device.createBindGroup({
            layout: Game.gpu.pipelines.instancedTextured.getBindGroupLayout(2),
            entries: [
                {
                    binding: 0,
                    resource: this.sampler!
                },
                {
                    binding: 1,
                    resource: this.texture!.createView()
                }
            ]
        });

        this.uploaded = true;
    }

    attach(rp: GPURenderPassEncoder): void {
        super.attach(rp);
        rp.setBindGroup(2, this.bindGroup!)
    }
}
