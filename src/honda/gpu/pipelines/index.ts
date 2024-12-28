import { WebGpu } from "..";
import { createBloom } from "./bloom.pipeline";
import { createBlur } from "./blur.pipeline";
import { createG, createGNorm } from "./g.pipeline";
import { createPostProcess } from "./postprocess.pipeline";
import { createShade } from "./shade.pipeline";
import { createShadow } from "./shadow.pipeline";
import { createSky } from "./sky.pipeline";
import { createSSAO } from "./ssao.pipeline";

export function createPipelines(g: WebGpu) {
    return {
        g: createG(g),
        gNorm: createGNorm(g),
        shadow: createShadow(g),
        post: createPostProcess(g),
        ssao: createSSAO(g),
        shade: createShade(g),
        sky: createSky(g),
        bloom: createBloom(g),
        blurRgbaF16: createBlur(g, "rgba16float"),
    };
}
