import { WebGpu } from "..";
import { TRI_LIST_CULLED } from "./constants";

export function createPostProcess(g: WebGpu) {
    const { module } = g.shaderModules.favelapost;

    return g.device.createRenderPipeline({
        label: "post",
        layout: "auto",
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
