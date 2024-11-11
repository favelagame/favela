export type MeshType = "basicColor" | "basicTextured";

export interface IMesh {
    // static-ish things
    setupPipeline(): void;
    
    // pipeline key
    type: MeshType;

    // deduplication key
    bufKey: number;

    // number of vertecies
    drawCount: number;

    // upload data to GPU
    upload(): void;

    // attach mesh's buffers/textures/samplers...
    attach(rp: GPURenderPassEncoder): void;
}
