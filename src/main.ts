import {
    Input,
    WebGpu,
    Game,
    ScriptSystem,
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
    SoundSystem,
    PhysicsSystem,
    NavSystem,
} from "@/honda";
import { perfRenderer } from "@/honda/util/perf";
import { setError, setStatus } from "@/honda/util/status";

import { createScene } from "./scene";
import { Flags } from "./honda/util/flags";

const MAX_STEP = 0.1; // Atleast 10 updates per second

function frame() {
    Game.perf.startFrame();
    Game.input.frame();

    const now = Math.min(performance.now() / 1000, Game.time + MAX_STEP);
    Game.deltaTime = now - Game.time;
    Game.time = now;

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
    Game.passes.forEach((x) => x.apply());

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

document.addEventListener("keypress", (e) => {
    if (e.code === "KeyP") {
        document.querySelector("#perf")!.classList.toggle("hidden");
        document.querySelector("muigui-element")!.classList.toggle("hidden");
    }
});

document.querySelector("muigui-element")!.classList.add("hidden");
document.querySelector("#perf")!.classList.toggle("hidden");

const play = async () => {
    const selected = document.querySelector<HTMLInputElement>("input:checked")!
        .value as "low" | "medium" | "high";

    Game.flags = new Set<Flags>(
        (
            {
                low: ["rsHalf", "noSSAO", "shadowLow"],
                medium: ["shadowLow"],
                high: [],
            } satisfies Record<string, Flags[]>
        )[selected]
    );
    const canvas = document.querySelector("canvas")!;
    try {
        Game.gpu = await WebGpu.obtainForCanvas(canvas);
    } catch (e) {
        setError((e as object).toString());
        throw e;
    }
    Game.input = new Input(canvas);
    Game.ecs.addSystem(new NavSystem());
    Game.ecs.addSystem(new ScriptSystem());
    Game.ecs.addSystem(new MeshSystem());
    Game.ecs.addSystem(new CameraSystem());
    Game.ecs.addSystem(new LightSystem());
    Game.ecs.addSystem(new PhysicsSystem());
    Game.ecs.addSystem(new SoundSystem());

    const extras = await createScene();

    Game.passes = [
        new GBufferPass(),
        new SSAOPass(),
        new ShadowMapPass(),
        new SkyPass(extras.skyTex),
        new ShadePass(),
        new BloomPass(),
        new PostprocessPass(),
    ];

    setStatus(undefined);
    Game.cmdEncoder = Game.gpu.device.createCommandEncoder();

    document.querySelector(".menu")!.classList.add("hidden");
    Game.time = performance.now() / 1000; //get inital timestamp so delta isnt broken
    requestAnimationFrame(frame);
};
document.querySelector("#play")!.addEventListener("click", play);
