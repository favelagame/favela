import { mat4 } from "wgpu-matrix";
import type { WebGpu } from "./gpu";
import type { Input } from "./input";
import { Perf } from "./util/perf";
import { ECS } from "./ecs";

export const Game = {
    ecs: null! as ECS,
    time: 0,
    deltaTime: 0,
    gpu: null! as WebGpu,
    cmdEncoder: null! as GPUCommandEncoder,
    cameraMatrix: mat4.create(),
    input: null! as Input,
    perf: new Perf(),
};
