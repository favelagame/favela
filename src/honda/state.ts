import { mat4 } from "wgpu-matrix";

import type { WebGpu } from "./gpu";
import type { Input } from "./input";
import type { ECS } from "./ecs";
import { Perf } from "./util/perf";
import GUI from "muigui";
import { Flags } from "./flags";

export const Game = {
    ecs: null! as ECS,
    time: 0,
    deltaTime: 0,
    gpu: null! as WebGpu,
    cmdEncoder: null! as GPUCommandEncoder,
    cameraMatrix: mat4.create(),
    input: null! as Input,
    perf: new Perf(),
    gui: new GUI(),

    flags: new Set(window.location.hash.substring(1).split(",") as Flags[]),
};

//@ts-expect-error expose state to the console
window.Game = Game;
