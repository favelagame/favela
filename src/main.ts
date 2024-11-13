import "reflect-metadata";

import { WebGpu } from "@/honda/gpu";
import { ECS, Game } from "@/honda/core";
import { setupScene } from "./scene";
import { Input } from "./honda/input";
import { perfRenderer } from "./honda/util/perf";
import { setError, setStatus } from "./honda/util/status";
import { PostprocessPass } from "./honda/gpu/post.pass";

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
const pp = new PostprocessPass();
await setupScene(ecs);
setStatus(undefined);
Game.cmdEncoder = Game.gpu.device.createCommandEncoder();

function frame(t: number) {
    Game.perf.startFrame();
    Game.input.frame();
    Game.deltaTime = t - Game.time;
    Game.time = t;
    Game.gpu.frameStart();

    Game.cmdEncoder
        .beginRenderPass({
            label: "clear",
            depthStencilAttachment: {
                view: Game.gpu.depthTextureView,
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 1,
            },
            colorAttachments: [
                {
                    view: Game.gpu.renderTextureView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: [0.4, 0.7, 1, 1],
                },
            ],
        })
        .end();

    ecs.update();

    pp.apply();

    //TODO(mbabnik): clean up the main loop
    Game.input.endFrame();
    Game.gpu.pushQueue();
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
        $<HTMLPreElement>("#measured")!
    ),
    500
);

requestAnimationFrame(frame);
Game.time = performance.now(); //get inital timestamp so delta isnt broken
