import { WebGpu } from "./gpu";

export const Game = {
    time: 0,
    deltaTime: 0,
    gpu: null! as WebGpu,
    cmdEncoder: null! as GPUCommandEncoder,
};
