export const TRI_LIST_CULLED = {
    cullMode: "back",
    topology: "triangle-list",
} satisfies GPUPrimitiveState;

export const VERTEX_POS_UV_NORM = [
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
        arrayStride: 8,
        attributes: [
            {
                offset: 0,
                format: "float32x2",
                shaderLocation: 1,
            },
        ],
    },
    {
        arrayStride: 12,
        attributes: [
            {
                offset: 0,
                format: "float32x3",
                shaderLocation: 2,
            },
        ],
    },
] satisfies GPUVertexBufferLayout[];

export const VERTEX_POS_UV_NORM_TAN = [
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
        arrayStride: 8,
        attributes: [
            {
                offset: 0,
                format: "float32x2",
                shaderLocation: 1,
            },
        ],
    },
    {
        arrayStride: 12,
        attributes: [
            {
                offset: 0,
                format: "float32x3",
                shaderLocation: 2,
            },
        ],
    },
    {
        arrayStride: 16,
        attributes: [
            {
                offset: 0,
                format: "float32x4",
                shaderLocation: 3,
            },
        ],
    },
] satisfies GPUVertexBufferLayout[];

export const VERTEX_POS = [
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
] satisfies GPUVertexBufferLayout[];

export const DEPTHTEST_LESS_WRITE = {
    depthWriteEnabled: true,
    depthCompare: "less",
    format: "depth24plus",
} satisfies GPUDepthStencilState;
