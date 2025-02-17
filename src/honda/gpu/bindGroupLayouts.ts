import { WebGpu } from ".";

const MATERIAL_BASE = [
    {
        binding: 0, // material settings
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
    },
    {
        binding: 1, // base tex
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
    },
    {
        binding: 2, // base sampler
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
    },
    {
        binding: 3, // mtlRgh tex
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
    },
    {
        binding: 4, // mtlRgh sampler
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
    },
    {
        binding: 5, // emission tex
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
    },
    {
        binding: 6, // emission sampler
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
    },
] satisfies GPUBindGroupLayoutEntry[];

export function createBindGroupLayouts(g: WebGpu) {
    return {
        g: g.device.createBindGroupLayout({
            label: "gBGL",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: "read-only-storage",
                    },
                },
            ],
        }),
        post: g.device.createBindGroupLayout({
            label: "postBGL",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "depth" },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
            ],
        }),
        ssao: g.device.createBindGroupLayout({
            label: "ssaoBGL",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "unfilterable-float" },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "depth" },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                },
            ],
        }),
        shade: g.device.createBindGroupLayout({
            label: "shadeBGL",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform",
                    },
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
                {
                    binding: 6,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "depth" },
                },
                {
                    binding: 7,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                },
                {
                    binding: 8,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: "depth", viewDimension: "2d-array" },
                },
                {
                    binding: 9,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "comparison" },
                },
            ],
        }),
        material: g.device.createBindGroupLayout({
            label: "materialNoNormalBGL",
            entries: MATERIAL_BASE,
        }),
        shadow: g.device.createBindGroupLayout({
            label: "shadowBGL",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: "uniform",
                        hasDynamicOffset: true,
                        minBindingSize: 64,
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: "read-only-storage",
                    },
                },
            ],
        }),
        materialNormal: g.device.createBindGroupLayout({
            label: "materialNormalBGL",
            entries: [
                ...MATERIAL_BASE,
                {
                    binding: 7, // normal tex
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
                {
                    binding: 8, // normal sampler
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                },
            ],
        }),
        bloom: g.device.createBindGroupLayout({
            label: "bloomBGL",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
            ],
        }),
        blur: g.device.createBindGroupLayout({
            label: "blurBGL",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform",
                        hasDynamicOffset: true,
                        minBindingSize: 1280,
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                },
            ],
        }),
    };
}
