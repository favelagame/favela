import { vec3, vec4 } from "wgpu-matrix";
import * as Mat from "./material.types";
import { Game } from "@/honda/state";
import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";
export const TRANSPARENCY_BIT = 0x1;
export const NORMALMAP_BIT = 0x2;

const MaterialStruct = makeShaderDataDefinitions(`struct Material {
    baseFactor: vec4f,
    emissionFactor: vec3f,
    metalFactor: f32,
    roughFactor: f32,
    normalScale: f32,
    alphaCutoff: f32,
    ignoreAlpha: u32
};`).structs.Material;

export class Material {
    protected static defaultTexture?: GPUTexture;

    protected static getDefaultTexture(): GPUTexture {
        if (!Material.defaultTexture) {
            Material.defaultTexture = Game.gpu.device.createTexture({
                label: "MATERIAL_DUMMY",
                format: "rgba8unorm",
                size: [1, 1, 1],
                usage:
                    GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.RENDER_ATTACHMENT,
            });

            Game.gpu.device.queue.writeTexture(
                { texture: Material.defaultTexture },
                new Uint8Array([255, 255, 255, 255]),
                { bytesPerRow: 4 },
                [1, 1, 1]
            );
        }

        return this.defaultTexture!;
    }

    public static withoutTextures(
        color: [number, number, number],
        metal: number = 0.5,
        rough: number = 0.5,
        emission: [number, number, number] = [0, 0, 0],
        label?: string
    ) {
        const sampler = Game.gpu.getSampler({
            magFilter: "linear",
            minFilter: "linear",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
        });
        const texture = this.getDefaultTexture(); // a single white pixel
        return new Material(
            {
                factor: vec4.create(color[0], color[1], color[2], 1),
                sampler,
                texture,
            },
            {
                metalFactor: metal,
                roughFactor: rough,
                sampler,
                texture,
            },
            undefined,
            {
                factor: vec3.create(...emission),
                sampler,
                texture,
            },
            undefined,
            label
        );
    }

    public readonly type: number;

    public bindGroup!: GPUBindGroup;
    protected materialData!: GPUBuffer;
    protected emission: Mat.Emission;
    protected alpha: Mat.Alpha;

    public constructor(
        protected base: Mat.Base,
        protected metalRough: Mat.MetalicRoughness,
        protected normal?: Mat.Normal,
        emission?: Mat.Emission,
        alpha?: Mat.Alpha,
        public readonly label?: string
    ) {
        if (!emission) {
            const sampler = Game.gpu.getSampler({
                magFilter: "linear",
                minFilter: "linear",
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge",
            });
            const texture = Material.getDefaultTexture(); // a single white pixel
            this.emission = {
                texture,
                sampler,
                factor: vec3.create(0, 0, 0),
            };
        } else {
            this.emission = emission;
        }

        this.alpha = alpha ?? { mode: Mat.AlphaMode.OPAQUE };

        this.type =
            (normal != undefined ? NORMALMAP_BIT : 0) |
            (this.alpha.mode == Mat.AlphaMode.BLEND ? TRANSPARENCY_BIT : 0);
    }

    protected createGpuResources(): void {
        const label = `mat:${this.label ?? "unk"}${this.normal ? ":nm" : ""}`;

        const view = makeStructuredView(MaterialStruct);

        view.set({
            baseFactor: this.base.factor,
            emissionFactor: this.emission.factor,
            metalFactor: this.metalRough.metalFactor,
            roughFactor: this.metalRough.roughFactor,
            normalScale: this.normal?.scale ?? 1,
            alphaCutoff: this.alpha.alphaCutoff ?? 0.5,
            ignoreAlpha: this.alpha.mode == Mat.AlphaMode.OPAQUE,
        });

        this.materialData = Game.gpu.device.createBuffer({
            label,
            size: view.arrayBuffer.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });

        Game.gpu.device.queue.writeBuffer(
            this.materialData,
            0,
            view.arrayBuffer
        );

        const optionalNormalMap = this.normal
            ? [
                  { binding: 7, resource: this.normal!.texture.createView() },
                  { binding: 8, resource: this.normal!.sampler },
              ]
            : [];

        this.bindGroup = Game.gpu.device.createBindGroup({
            label,
            layout: this.normal
                ? Game.gpu.bindGroupLayouts.materialNormal
                : Game.gpu.bindGroupLayouts.material,
            entries: [
                { binding: 0, resource: { buffer: this.materialData } },
                { binding: 1, resource: this.base.texture.createView() },
                { binding: 2, resource: this.base.sampler },
                { binding: 3, resource: this.metalRough.texture.createView() },
                { binding: 4, resource: this.metalRough.sampler },
                { binding: 5, resource: this.emission!.texture.createView() },
                { binding: 6, resource: this.emission!.sampler },
                ...optionalNormalMap,
            ],
        });
    }
}