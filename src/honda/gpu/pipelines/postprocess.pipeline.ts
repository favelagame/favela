import { WebGpu } from "..";
import { TRI_LIST_CULLED } from "./constants";

export function createPostProcess(g: WebGpu) {
    const { module } = g.shaderModules.postprocess;

    return g.device.createRenderPipeline({
        label: "post",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.post],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format: g.pFormat }],
        },
    });
}
