import { Entity, System } from "@/honda/ecs";
import { TransformComponent } from "../transform";
import { LightComponent } from "./light.component";
import { Game } from "@/honda/state";
import { makeStructuredView } from "webgpu-utils";
import { mat4, Mat4, quat, Vec3, vec3 } from "wgpu-matrix";
import { IPointLight, ISpotLight, THondaLight } from "./lights.interface";
import { Limits } from "@/honda/limits";

interface ILightData {
    position: Vec3;
    direction: Vec3;
    color: [number, number, number];
    ltype: number;
    intensity: number;
    maxRange: number;
    innerCone: number;
    outerCone: number;
    shadowMap: number;
    VP: Mat4 | undefined;
}

const TYPE_MAP: Record<THondaLight["type"], number> = {
    point: 0,
    directional: 1,
    spot: 2,
};

const DIR_RADIUS = 16;

export class LightSystem extends System {
    public componentsRequired = new Set([TransformComponent, LightComponent]);

    public lightsBuf: GPUBuffer;
    public shadowmapMatrices: GPUBuffer;

    public nLights = 0;
    public nShadowmaps = 0;

    public matrixAlignedSize = 64;

    protected lightVPMat: ArrayBuffer;

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

        this.matrixAlignedSize = Math.max(
            64,
            Game.gpu.device.limits.minUniformBufferOffsetAlignment
        );

        this.lightVPMat = new ArrayBuffer(
            this.matrixAlignedSize * Limits.MAX_SHADOWMAPS
        );

        this.shadowmapMatrices = Game.gpu.device.createBuffer({
            label: "shadowmapMatrices",
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            size: this.lightVPMat.byteLength,
        });
    }

    public update(entities: Set<Entity>): void {
        this.nShadowmaps = 0;

        const lights: ILightData[] = [];
        //tmp matrices
        const proj = mat4.create(),
            view = mat4.create();

        for (const e of entities) {
            const c = this.ecs.getComponents(e);
            const l = c.get(LightComponent);
            const t = c.get(TransformComponent);

            let shadowMap = -1;
            let vp: Mat4 | undefined;

            if (l.lightInfo.castShadows && l.lightInfo.type != "point") {
                shadowMap = this.nShadowmaps++;

                vp = new Float32Array(
                    this.lightVPMat,
                    this.matrixAlignedSize * shadowMap,
                    16
                );

                mat4.fromQuat(quat.inverse(t.rotation), view);
                mat4.translate(view, vec3.negate(t.translation), view);

                if (l.lightInfo.type == "directional") {
                    //TODO(mbabnik): figure out a better way to setup directional lights
                    mat4.ortho(
                        -DIR_RADIUS,
                        DIR_RADIUS,
                        -DIR_RADIUS,
                        DIR_RADIUS,
                        -DIR_RADIUS,
                        DIR_RADIUS,
                        proj
                    );
                } else {
                    //TODO(mbabnik): use maxRange or some function of intensity for far plane
                    mat4.perspective(l.lightInfo.outerCone * 2, 1, 0.0001, 10, proj);
                }

                mat4.mul(proj, view, vp);
            }

            lights.push({
                position: t.translation,
                direction: vec3.transformQuat([0, 0, -1], t.rotation),
                color: l.lightInfo.color,
                ltype: TYPE_MAP[l.lightInfo.type],
                intensity: l.lightInfo.intensity,
                maxRange: (l.lightInfo as IPointLight).maxRange ?? 0,
                innerCone: (l.lightInfo as ISpotLight).innerCone ?? 0,
                outerCone: (l.lightInfo as ISpotLight).outerCone ?? 0,
                shadowMap,
                VP: vp,
            });
        }

        this.lights.set(lights);
        this.nLights = entities.size;

        Game.gpu.device.queue.writeBuffer(
            this.lightsBuf,
            0,
            this.lights.arrayBuffer
        );

        Game.gpu.device.queue.writeBuffer(
            this.shadowmapMatrices,
            0,
            this.lightVPMat
        );
    }
}
