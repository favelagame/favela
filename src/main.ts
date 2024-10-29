import "reflect-metadata";
import { WebGpu } from "@/honda/gpu";
import { ECS, Game } from "@/honda/core";
import { setupScene } from "./scene";
import { Input } from "./honda/input";

const canvas = document.querySelector("canvas")!;
Game.gpu = await WebGpu.obtainForCanvas(canvas);
Game.input = new Input(canvas);

const ecs = new ECS();
setupScene(ecs);

function frame(t: number) {
    Game.input.frame()
    Game.deltaTime = t - Game.time;
    Game.time = t;
    Game.cmdEncoder = Game.gpu.device.createCommandEncoder();

    Game.cmdEncoder
        .beginRenderPass({
            label: "clear",
            depthStencilAttachment: {
                view: Game.gpu.depthTexture.createView(), // FIXME(mbabnik) This "leaks" resources? (they get GCd tho afaik)
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 1,
            },
            colorAttachments: [
                {
                    view: Game.gpu.ctx.getCurrentTexture().createView(),
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: [0.8, 0.8, 1, 1],
                },
            ],
        })
        .end();

    ecs.update();
    Game.input.endFrame();

    Game.gpu.device.queue.submit([Game.cmdEncoder.finish()]);
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
Game.time = performance.now(); //get inital timestamp so delta isnt broken
