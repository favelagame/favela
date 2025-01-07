import {
    Input,
    WebGpu,
    Game,
    ScriptSystem,
    IPass,
    PostprocessPass,
    SSAOPass,
    SkyPass,
    GBufferPass,
    ShadowMapPass,
    BloomPass,
    ShadePass,
    MeshSystem,
    CameraSystem,
    LightSystem,
} from "@/honda";
import { perfRenderer } from "./honda/util/perf";
import { setError, setStatus } from "./honda/util/status";

import { createScene } from "./scene";

const canvas = document.querySelector("canvas")!;
try {
    Game.gpu = await WebGpu.obtainForCanvas(canvas);
} catch (e) {
    setError((e as object).toString());
    throw e;
}
Game.input = new Input(canvas);
Game.ecs.addSystem(new ScriptSystem());
Game.ecs.addSystem(new MeshSystem());
Game.ecs.addSystem(new CameraSystem());
Game.ecs.addSystem(new LightSystem());

const extras = await createScene();

const passes: IPass[] = [
    new GBufferPass(),
    new SSAOPass(),
    new ShadowMapPass(),
    new SkyPass(extras.skyTex), //TODO(mbabnik): move this to scene
    new ShadePass(),
    new BloomPass(),
    new PostprocessPass(),
];

setStatus(undefined);
Game.cmdEncoder = Game.gpu.device.createCommandEncoder();

function frame(t: number) {
    Game.perf.startFrame();
    Game.input.frame();
    Game.deltaTime = t - Game.time;
    Game.time = t;

    Game.perf.measure("earlyUpdate");
    Game.ecs.earlyUpdate();
    Game.perf.measure("update");
    Game.ecs.update();
    Game.perf.measure("transforms");
    Game.scene.computeTransforms();
    Game.perf.measure("lateUpdate");
    Game.ecs.lateUpdate();
    Game.perf.measure("gpu");
    Game.gpu.frameStart();
    passes.forEach((x) => x.apply());

    Game.input.endFrame();
    Game.gpu.endFrame();
    Game.perf.measureEnd();
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
