import "reflect-metadata";

import { WebGpu } from "@/honda/gpu";
import {
    // CameraSystem,
    // ECS,
    Game,
    // LightSystem,
    // MeshSystem,
    // ScriptSystem,
} from "@/honda/core";
// import { setupScene } from "./scene";
import { Input } from "./honda/input";
import { perfRenderer } from "./honda/util/perf";
import { setError, setStatus } from "./honda/util/status";
// import { PostprocessPass } from "./honda/gpu/passes/post.pass";
// import { SSAOPass } from "./honda/gpu/passes/ssao.pass";
// import { ShadePass } from "./honda/gpu/passes/shade.pass";
// import { SkyPass } from "./honda/gpu/passes/sky";
// import { GBufferPass } from "./honda/gpu/passes/gbuf/gbuf.pass";
// import { ShadowMapPass } from "./honda/gpu/passes/shadow.pass";
// import { BloomPass } from "./honda/gpu/passes/bloom.pass";
import { IPass } from "./honda/gpu/passes/pass.interface";
import { createScene } from "./scene2";

const canvas = document.querySelector("canvas")!;
try {
    Game.gpu = await WebGpu.obtainForCanvas(canvas);
} catch (e) {
    setError((e as object).toString());
    throw e;
}

Game.input = new Input(canvas);

// const extras = await setupScene(ecs);
createScene();

const passes: IPass[] = [
    // new GBufferPass(),
    // new SSAOPass(),
    // new ShadowMapPass(),
    // new SkyPass(extras.skyTex),
    // new ShadePass(),
    // new BloomPass(),
    // new PostprocessPass(),
];

setStatus(undefined);
Game.cmdEncoder = Game.gpu.device.createCommandEncoder();

function frame(t: number) {
    Game.perf.startFrame();
    Game.input.frame();
    Game.deltaTime = t - Game.time;
    Game.time = t;

    Game.ncs.earlyUpdate();
    Game.ncs.update();
    Game.gpu.frameStart();

    passes.forEach((x) => x.apply());

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
