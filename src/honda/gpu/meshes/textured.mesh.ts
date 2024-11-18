import { nMips } from "@/honda/util";
import { Game } from "../../state";
import { TexturedMeshDataV2 } from "../../util/gltf";
import { GpuMeshV1 } from "./basic.mesh";
import { IMesh, MeshType } from "./mesh.interface";
import { generateMipmap } from "webgpu-utils";

function setupPipeline() {}

export class GpuTexturedMeshV1 extends GpuMeshV1 implements IMesh {
    public bufKey: number;
    public readonly type: MeshType = "basicTextured";
    public readonly setupPipeline = setupPipeline;

    protected texture?: GPUTexture;
    protected sampler?: GPUSampler;
    protected bindGroup?: GPUBindGroup;
    protected normalMap?: GPUTexture;

    protected static defaultNormalMap?: GPUTexture;

    constructor(protected meshData: TexturedMeshDataV2) {
        super(meshData);
        this.bufKey = meshData.id;
    }

    upload(): void {
        super.upload();
        const baseTexImg = this.meshData.baseTex.image;

        //TODO: prevent creating duplicate textures (cache?)
        this.texture = Game.gpu.device.createTexture({
            format: "rgba8unorm-srgb",
            size: [baseTexImg.width, baseTexImg.height],
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
            mipLevelCount: nMips(baseTexImg.width, baseTexImg.height),
        });

        Game.gpu.device.queue.copyExternalImageToTexture(
            {
                source: baseTexImg,
            },
            {
                texture: this.texture!,
            },
            [baseTexImg.width, baseTexImg.height, 1]
        );

        generateMipmap(Game.gpu.device, this.texture);

        const normalTexImg = this.meshData.normalTex?.image;
        if (normalTexImg) {
            this.normalMap = Game.gpu.device.createTexture({
                format: "rgba8unorm-srgb",
                size: [normalTexImg.width, normalTexImg.height],
                usage:
                    GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.RENDER_ATTACHMENT,
                mipLevelCount: nMips(normalTexImg.width, normalTexImg.height),
            });

            Game.gpu.device.queue.copyExternalImageToTexture(
                {
                    source: normalTexImg,
                },
                {
                    texture: this.normalMap!,
                },
                [normalTexImg.width, normalTexImg.height, 1]
            );

            generateMipmap(Game.gpu.device, this.normalMap);
        } else {
            if (!GpuTexturedMeshV1.defaultNormalMap) {
                const normalMapData = new Uint8Array([128, 128, 255, 255]); // Flat normal map data
                GpuTexturedMeshV1.defaultNormalMap =
                    Game.gpu.device.createTexture({
                        format: "rgba8unorm-srgb",
                        size: [1, 1, 1],
                        usage:
                            GPUTextureUsage.TEXTURE_BINDING |
                            GPUTextureUsage.COPY_DST |
                            GPUTextureUsage.RENDER_ATTACHMENT,
                    });

                Game.gpu.device.queue.writeTexture(
                    { texture: GpuTexturedMeshV1.defaultNormalMap },
                    normalMapData,
                    { bytesPerRow: 4 },
                    [1, 1, 1]
                );
            }

            this.normalMap = GpuTexturedMeshV1.defaultNormalMap;
        }

        this.sampler = Game.gpu.getSampler(
            this.meshData.baseTex.samplerDescriptor
        );

        this.bindGroup = Game.gpu.device.createBindGroup({
            layout: Game.gpu.pipelines.instancedTextured.getBindGroupLayout(2),
            entries: [
                {
                    binding: 0,
                    resource: this.sampler!,
                },
                {
                    binding: 1,
                    resource: this.texture!.createView(),
                },
                {
                    binding: 2,
                    resource: this.normalMap!.createView(),
                },
            ],
        });

        this.uploaded = true;
    }

    attach(rp: GPURenderPassEncoder): void {
        super.attach(rp);
        rp.setBindGroup(2, this.bindGroup!);
    }
}
