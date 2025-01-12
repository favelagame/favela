import type { WebGpu } from "./gpu";
import type { Input } from "./util/input";
import { Perf } from "./util/perf";
import GUI from "muigui";
import { Flags } from "./util/flags";
import { ECS } from "./core/ecs";
import { Scene } from "./core/scene";

export const Game = {
    ecs: new ECS(),
    scene: new Scene(),

    time: 0,
    deltaTime: 0,

    gpu: null! as WebGpu,
    input: null! as Input,
    cmdEncoder: null! as GPUCommandEncoder,

    gui: new GUI(),
    perf: new Perf(),

    flags: new Set(window.location.hash.substring(1).split(",") as Flags[]),
};

//@ts-expect-error expose state to the console
window.Game = Game;

//@ts-expect-error expose state to the console
window.finish = (win: boolean) => {
    if (win) {
        document.querySelector(".win")?.classList.remove("hidden");
    } else {
        document.querySelector(".lose")?.classList.remove("hidden");
    }
}