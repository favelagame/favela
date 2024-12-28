import { vec3, vec4 } from "wgpu-matrix";
import * as Mat from "./material.types";
import { Game } from "@/honda/state";
import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";
import { getNewResourceId } from "@/honda/util/resource";
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
                viewFormats: ["rgba8unorm", "rgba8unorm-srgb"],
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
        return new Material(
            { factor: vec4.create(color[0], color[1], color[2], 1) },
            { metalFactor: metal, roughFactor: rough },
            undefined,
            { factor: vec3.create(...emission) },
            {},
            label
        );
    }

    public readonly type: number;
    public readonly id: number;

    public bindGroup!: GPUBindGroup;
    protected materialData!: GPUBuffer;
    protected emission: Mat.Emission;
    protected alpha: Mat.Alpha;
    protected base: Mat.Base;
    protected normal?: Mat.Normal;
    protected metalRough: Mat.MetalicRoughness;

    public constructor(
        base: Partial<Mat.Base>,
        metalRough: Partial<Mat.MetalicRoughness>,
        normal: Mat.NormalOpt | undefined,
        emission: Partial<Mat.Emission>,
        alpha: Partial<Mat.Alpha>,
        public readonly label?: string
    ) {
        this.id = getNewResourceId();
        const sampler = Game.gpu.getSampler({
            magFilter: "linear",
            minFilter: "linear",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
        });
        const texture = Material.getDefaultTexture(); // a single white pixel

        this.base = {
            factor: base.factor ?? vec4.create(1, 1, 1, 1),
            sampler: base.sampler ?? sampler,
            texture: base.texture ?? texture,
        };

        this.metalRough = {
            metalFactor: metalRough.metalFactor ?? 1,
            roughFactor: metalRough.roughFactor ?? 1,
            sampler: metalRough.sampler ?? sampler,
            texture: metalRough.texture ?? texture,
        };

        this.emission = {
            factor: emission.factor ?? vec3.create(0, 0, 0), // no emission by default
            sampler: emission.sampler ?? sampler,
            texture: emission.texture ?? texture,
        };

        this.alpha = {
            mode: alpha.alphaCutoff ?? Mat.AlphaMode.OPAQUE,
            alphaCutoff: alpha.alphaCutoff ?? 0.5,
        };

        this.type =
            (normal != undefined ? NORMALMAP_BIT : 0) |
            (this.alpha.mode == Mat.AlphaMode.BLEND ? TRANSPARENCY_BIT : 0);

        if (normal) {
            this.normal = {
                sampler: normal.sampler ?? sampler,
                texture: normal.texture,
                scale: normal.scale ?? 1,
            };
        }

        this.createGpuResources();
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
            ignoreAlpha: this.alpha.mode == Mat.AlphaMode.OPAQUE ? 1 : 0,
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
                  {
                      binding: 7,
                      resource: this.normal!.texture.createView({
                          label: `${label}:normalmap`,
                          format: "rgba8unorm",
                      }),
                  },
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
                {
                    binding: 1,
                    resource: this.base.texture.createView({
                        label: `${label}:base`,
                        format: "rgba8unorm-srgb",
                    }),
                },
                { binding: 2, resource: this.base.sampler },
                {
                    binding: 3,
                    resource: this.metalRough.texture.createView({
                        label: `${label}:mtlrghmap`,
                        format: "rgba8unorm",
                    }),
                },
                { binding: 4, resource: this.metalRough.sampler },
                {
                    binding: 5,
                    resource: this.emission!.texture.createView({
                        label: `${label}:emission`,
                        format: "rgba8unorm",
                    }),
                },
                { binding: 6, resource: this.emission!.sampler },
                ...optionalNormalMap,
            ],
        });
    }
}
