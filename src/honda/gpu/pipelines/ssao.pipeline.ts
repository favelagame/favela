import { WebGpu } from "..";
import { TRI_LIST_CULLED } from "./constants";

export function createSSAO(g: WebGpu) {
    const { module } = g.shaderModules.ssao;

    return g.device.createRenderPipeline({
        label: "ssao",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.ssao],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format: 'r8unorm' }],
        },
    });
}
