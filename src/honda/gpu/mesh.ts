import { MeshDataV1, TypedArrays } from "@/honda/util/gltf";
import { Game } from "../state";

/**
 * Utility function that clones a CPU Typed array into a GPU buffer.
 * Meant mostly for static data.
 * @param src the array to copy to GPU
 * @param usage GPU buffer usage
 * @returns GPU buffer that holds the current contents of src
 */
function initGpuBuffer(src: TypedArrays, usage: GPUBufferUsageFlags) {
    const b = Game.gpu.device.createBuffer({
        size: src.byteLength,
        usage: usage | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });

    /*
    src's view can be F32, U16,... For the copy to work we need to wrap the
    dest in the same kind of type
    */
    //@ts-expect-error "God, I wish there was an easier way to do this"
    const dst = new src.constructor(b.getMappedRange()) as TypedArrays;
    dst.set(src);
    b.unmap();

    return b;
}

/**
 * "V1" Mesh, current functionality is:
 *  - vec3 position
 *  - vec3 normal
 *  - vec2 uv
 *  - indexed rendering
 * No support for textures/materials/animation here
 */
export class GpuMeshV1 {
    protected uploaded = false;
    protected positionBuffer?: GPUBuffer;
    protected normalBuffer?: GPUBuffer;
    protected uvBuffer?: GPUBuffer;
    protected indexBuffer?: GPUBuffer;

    public drawCount = 0;
    constructor(protected meshData: MeshDataV1) {
        this.drawCount = meshData.indexBuffer.count;
    }

    upload() {
        this.positionBuffer = initGpuBuffer(
            this.meshData.posBuffer.accessor,
            GPUBufferUsage.VERTEX
        );
        this.normalBuffer = initGpuBuffer(
            this.meshData.normBuffer.accessor,
            GPUBufferUsage.VERTEX
        );
        this.uvBuffer = initGpuBuffer(
            this.meshData.uvBuffer.accessor,
            GPUBufferUsage.VERTEX
        );
        this.indexBuffer = initGpuBuffer(
            this.meshData.indexBuffer.accessor,
            GPUBufferUsage.INDEX
        );

        this.uploaded = true;
    }

    attach(rp: GPURenderPassEncoder) {
        rp.setVertexBuffer(0, this.positionBuffer!);
        rp.setVertexBuffer(1, this.normalBuffer!);
        rp.setVertexBuffer(2, this.uvBuffer!);
        rp.setIndexBuffer(this.indexBuffer!, "uint16");
    }

    //TODO(mbabnik): Expose buffers or add a function that binds mesh
}
