import { mat4 } from "wgpu-matrix";
import type { WebGpu } from "./gpu";
import type { Input } from "./input";

export const Game = {
    time: 0,
    deltaTime: 0,
    gpu: null! as WebGpu,
    cmdEncoder: null! as GPUCommandEncoder,
    cameraMatrix: mat4.create(),
    input: null! as Input,
};
