import { Entity, System } from "@/honda/ecs";
import { TransformComponent } from "../transform";
import { LightComponent } from "./light.component";
import { Game } from "@/honda/state";

const LIGHT_DATA_SIZE = 128; // A completely YOLO number for now

export class LightSystem extends System {
    public componentsRequired = new Set([TransformComponent, LightComponent]);

    public lightsBuf: GPUBuffer;
    public nLights = 0;
    protected lights: ArrayBuffer;

    constructor(maxLights = 128) {
        super();
        this.lights = new ArrayBuffer(maxLights * LIGHT_DATA_SIZE);
        this.lightsBuf = Game.gpu.device.createBuffer({
            label: "lights",
            size: this.lights.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
    }

    public update(entities: Set<Entity>): void {
        for (const ent of entities) {
            //TODO: write light data
            console.log(ent);
        }

        this.nLights = entities.size;
    }
}
