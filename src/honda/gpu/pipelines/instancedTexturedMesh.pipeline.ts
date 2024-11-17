import { WebGpu } from "..";
import {
    TRI_LIST_CULLED,
    VERTEX_POS_NORM_UV,
    DEPTHTEST_LESS_WRITE,
} from "./constants";

export function createTexturedMeshInstanced(g: WebGpu) {
    const { module } = g.shaderModules.instancedTexturedMesh;

    return g.device.createRenderPipeline({
        label: "texturedMeshInstanced",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [
                g.bindGroupLayouts.favelaUniforms,
                g.bindGroupLayouts.instance,
                g.bindGroupLayouts.textured,
            ],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
            buffers: VERTEX_POS_NORM_UV,
        },
        fragment: {
            module,
            targets: [{ format: "rgba8unorm" }, { format: "rgba8unorm" }],
        },
        depthStencil: DEPTHTEST_LESS_WRITE,
    });
}
