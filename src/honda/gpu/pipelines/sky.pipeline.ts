import { WebGpu } from "..";
import { VERTEX_POS } from "./constants";

export function createSky(g: WebGpu) {
    const { module } = g.shaderModules.sky;

    return g.device.createRenderPipeline({
        label: "sky",
        layout: "auto",
        primitive: {
            cullMode:'none',
            topology:'triangle-list'
        },
        vertex: {
            module,
            buffers: VERTEX_POS,
        },
        fragment: {
            module,
            targets: [{ format: "rgba16float" }],
        },
    });
}
