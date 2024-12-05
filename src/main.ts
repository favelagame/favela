import "reflect-metadata";

import { WebGpu } from "@/honda/gpu";
import { ECS, Game } from "@/honda/core";
import { setupScene } from "./scene";
import { Input } from "./honda/input";
import { perfRenderer } from "./honda/util/perf";
import { setError, setStatus } from "./honda/util/status";
import { PostprocessPass } from "./honda/gpu/passes/post.pass";
import { SSAOPass } from "./honda/gpu/passes/ssao.pass";
import { ShadePass } from "./honda/gpu/passes/shade.pass";
import { SkyPass } from "./honda/gpu/passes/sky";

const canvas = document.querySelector("canvas")!;
try {
    Game.gpu = await WebGpu.obtainForCanvas(canvas);
} catch (e) {
    setError((e as object).toString());
    throw e;
}

Game.input = new Input(canvas);
const ecs = new ECS();
Game.ecs = ecs;
const ssao = new SSAOPass();
const shade = new ShadePass();
const postprocess = new PostprocessPass();
const extras = await setupScene(ecs);
const skybox = new SkyPass(extras.skyTex);

setStatus(undefined);
Game.cmdEncoder = Game.gpu.device.createCommandEncoder();

function frame(t: number) {
    Game.perf.startFrame();
    Game.input.frame();
    Game.deltaTime = t - Game.time;
    Game.time = t;
    Game.gpu.frameStart();

    ecs.update();

    // Render
    Game.cmdEncoder
        .beginRenderPass({
            label: "clear",
            depthStencilAttachment: {
                view: Game.gpu.textures.depth.view,
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 1,
            },
            colorAttachments: [],
        })
        .end();
    skybox.apply();
    ssao.apply();
    shade.apply();
    postprocess.apply();

    Game.input.endFrame();
    Game.gpu.endFrame();
    Game.perf.stopFrame();
    Game.gpu.wasResized = false;
    requestAnimationFrame(frame);
}

const $ = document.querySelector.bind(document);
setInterval(
    perfRenderer(
        $<HTMLSpanElement>("#fps")!,
        $<HTMLSpanElement>("#mspf")!,
        $<HTMLSpanElement>("#ents")!,
        $<HTMLPreElement>("#measured")!,
        $<HTMLPreElement>("#measured-gpu")!
    ),
    500
);

requestAnimationFrame(frame);
Game.time = performance.now(); //get inital timestamp so delta isnt broken
