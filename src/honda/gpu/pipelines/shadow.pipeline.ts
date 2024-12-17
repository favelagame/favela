import { WebGpu } from "..";
import { TRI_LIST_CULLED, VERTEX_POS_UV } from "./constants";

export function createShadow(g: WebGpu) {
    const { module } = g.shaderModules.shadow;

    return g.device.createRenderPipeline({
        label: "shadow",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.shadow],
        }),
        primitive: TRI_LIST_CULLED, // TODO(mbabnik): render both sides?
        vertex: {
            module,
            buffers: VERTEX_POS_UV,
        },
        fragment: {
            module,
            targets: [],
        },
        depthStencil: {
            format: "depth24plus",
            depthCompare: "less",
            depthWriteEnabled: true,
            depthBias: 2,
            depthBiasSlopeScale: 2.0,
            depthBiasClamp: 0.5
        },
    });
}
