export const TRI_LIST_CULLED = {
    cullMode: "back",
    topology: "triangle-list",
} satisfies GPUPrimitiveState;

export const VERTEX_POS_NORM_UV = [
    {
        arrayStride: 12,
        attributes: [
            {
                offset: 0,
                format: "float32x3",
                shaderLocation: 0,
            },
        ],
    },
    {
        arrayStride: 12,
        attributes: [
            {
                offset: 0,
                format: "float32x3",
                shaderLocation: 1,
            },
        ],
    },
    {
        arrayStride: 8,
        attributes: [
            {
                offset: 0,
                format: "float32x2",
                shaderLocation: 2,
            },
        ],
    },
] satisfies GPUVertexBufferLayout[];

export const DEPTHTEST_LESS_WRITE = {
    depthWriteEnabled: true,
    depthCompare: "less",
    format: "depth24plus",
} satisfies GPUDepthStencilState;
