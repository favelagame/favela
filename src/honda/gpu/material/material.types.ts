import { Vec3, Vec4 } from "wgpu-matrix";

export enum AlphaMode {
    OPAQUE = 0,
    MASK = 1,
    BLEND = 2,
}

export interface Texture {
    sampler: GPUSampler;
    texture: GPUTexture;
}

export interface Base extends Texture {
    factor: Vec4;
}

export interface MetalicRoughness extends Texture {
    metalFactor: number;
    roughFactor: number;
}

export interface Normal extends Texture {
    scale: number;
}

export interface Emission extends Base {
    factor: Vec3;
}

export interface Alpha {
    mode: AlphaMode;
    alphaCutoff?: number;
}
