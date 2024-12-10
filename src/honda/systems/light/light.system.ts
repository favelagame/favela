import { Entity, System } from "@/honda/ecs";
import { TransformComponent } from "../transform";
import { LightComponent } from "./light.component";
import { Game } from "@/honda/state";
import { makeStructuredView } from "webgpu-utils";
import { vec3 } from "wgpu-matrix";
import { IPointLight, ISpotLight, THondaLight } from "./lights.interface";

const TYPE_MAP: Record<THondaLight["type"], number> = {
    point: 0,
    directional: 1,
    spot: 2,
};

export class LightSystem extends System {
    public componentsRequired = new Set([TransformComponent, LightComponent]);

    public lightsBuf: GPUBuffer;
    public nLights = 0;
    protected lights = makeStructuredView(
        Game.gpu.shaderModules.shade.defs.uniforms.lights
    );

    constructor() {
        super();
        this.lightsBuf = Game.gpu.device.createBuffer({
            label: "lights",
            size: this.lights.arrayBuffer.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
    }

    public update(entities: Set<Entity>): void {
        this.lights.set(
            [...entities].map((x) => {
                const c = this.ecs.getComponents(x);
                const l = c.get(LightComponent);
                const t = c.get(TransformComponent);

                return {
                    position: t.translation,
                    direction: vec3.transformQuat([0, 0, -1], t.rotation),
                    color: l.lightInfo.color,
                    ltype: TYPE_MAP[l.lightInfo.type],
                    intensity: l.lightInfo.intersity,
                    maxRange: (l.lightInfo as IPointLight).maxRange ?? 0,
                    innerCone: (l.lightInfo as ISpotLight).innerCone ?? 0,
                    outerCone: (l.lightInfo as ISpotLight).outerCone ?? 0,
                };
            })
        );
        this.nLights = entities.size;

        Game.gpu.device.queue.writeBuffer(
            this.lightsBuf,
            0,
            this.lights.arrayBuffer
        );
    }
}
