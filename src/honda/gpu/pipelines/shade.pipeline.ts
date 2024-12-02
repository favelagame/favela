import { WebGpu } from "..";
import { TRI_LIST_CULLED } from "./constants";

export function createShade(g: WebGpu) {
    const { module } = g.shaderModules.shade;

    return g.device.createRenderPipeline({
        label: "shade",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.shade],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format: 'rgba16float' }],
        },
    });
}
