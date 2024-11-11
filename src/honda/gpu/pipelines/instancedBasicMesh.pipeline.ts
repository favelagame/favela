import { WebGpu } from "..";
import {
    TRI_LIST_CULLED,
    VERTEX_POS_NORM_UV,
    DEPTHTEST_LESS_WRITE,
} from "./constants";

export function createBasicMeshInstanced(g: WebGpu) {
    const { module } = g.shaderModules.instancedBasicMesh;

    return g.device.createRenderPipeline({
        label: "basicMeshInstanced",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [
                g.bindGroupLayouts.favelaUniforms,
                g.bindGroupLayouts.instance,
            ],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
            buffers: VERTEX_POS_NORM_UV,
        },
        fragment: {
            module,
            targets: [{ format: g.pFormat }],
        },
        depthStencil: DEPTHTEST_LESS_WRITE,
    });
}
