import { MAT4F_SIZE, VEC3F_SIZE } from "@/honda/gpu/const";

/**
 * Make sure to set colorAttachments[0].view and depthStencilAttachment.view
 */
export const RENDER_PASS_DESCRIPTOR = {
    label: "CubeRenderer",
    depthStencilAttachment: {
        view: null! as GPUTextureView,
        depthLoadOp: "load",
        depthStoreOp: "store",
    },
    colorAttachments: [
        {
            view: null! as GPUTextureView,
            loadOp: "load",
            storeOp: "store",
        },
    ] as [GPURenderPassColorAttachment],
} satisfies GPURenderPassDescriptor;

export const UNIFORM_BIND_GROUP = 0;
export const UNIFORM_BIND_GROUP_BINDING = 0;
export const UNIFORM_SIZE = MAT4F_SIZE + VEC3F_SIZE + 1 + 1;

export const UNIFORM_CAMERA_OFFSET = 0;
export const UNIFORM_SUN_OFFSET = MAT4F_SIZE;
export const UNIFORM_DELTA_TIME_OFFSET = MAT4F_SIZE + VEC3F_SIZE;
export const UNIFORM_TIME_OFFSET = MAT4F_SIZE + VEC3F_SIZE + 1;

export const INSTANCE_BIND_GROUP = 1;
export const INSTANCE_BIND_GROUP_BINDING = 0;
export const INSTANCE_SIZE = MAT4F_SIZE + VEC3F_SIZE;

export const INSTANCE_TRANSFORM_OFFSET = 0;
export const INSTANCE_COLOR_OFFSET = MAT4F_SIZE;
