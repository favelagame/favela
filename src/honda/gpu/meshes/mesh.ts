import { getNewResourceId } from "@/honda/util/resource";

export class Mesh {
    public readonly id: number;

    constructor(
        public readonly position: GPUBuffer,
        public readonly normal: GPUBuffer,
        public readonly texCoord: GPUBuffer,
        public readonly tangent: GPUBuffer | undefined,
        public readonly index: GPUBuffer,
        public readonly drawCount: number
    ) {
        this.id = getNewResourceId();
    }
}
