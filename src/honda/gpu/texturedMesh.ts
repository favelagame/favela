import { Game } from "../state";
import { TexturedMeshDataV1 } from "../util/gltf";
import { GpuMeshV1 } from "./mesh";

export class GpuTexturedMeshV1 extends GpuMeshV1 {
    protected texture?: GPUTexture;
    protected sampler?: GPUSampler;

    constructor(protected meshData: TexturedMeshDataV1) {
        super(meshData);
    }

    upload(): void {
        super.upload();

        this.texture = Game.gpu.device.createTexture({
            format: "rgba8unorm-srgb",
            size: [
                this.meshData.baseTex.image.width,
                this.meshData.baseTex.image.height,
            ],
            usage: GPUTextureUsage.TEXTURE_BINDING,
        }); //TODO: prevent creating duplicate textures (cache?)

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

        this.sampler = Game.gpu.device.createSampler(
            this.meshData.baseTex.samplerDescriptor
        ); //TODO: prevent creating duplicate samplers (cache?)
    }
}
