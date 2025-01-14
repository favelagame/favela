import { LightComponent } from "./light.component";
import { Game } from "@/honda/state";
import { makeStructuredView } from "webgpu-utils";
import { mat4, Mat4, Vec3, vec4 } from "wgpu-matrix";
import { IPointLight, ISpotLight, THondaLight } from "./lights.interface";
import { Limits } from "@/honda/limits";
import { System } from "@/honda/core/ecs";
import { SceneNode } from "@/honda/core/node";

interface ILightData {
    position: Vec3;
    direction: [number, number, number];
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
    public componentType = LightComponent;

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

    protected components = new Map<LightComponent, SceneNode>();

    public componentCreated(node: SceneNode, comp: LightComponent) {
        if (this.components.delete(comp)) {
            console.warn("moved component to new node", comp, node);
        }
        this.components.set(comp, node);
    }

    public componentDestroyed(_: SceneNode, comp: LightComponent) {
        this.components.delete(comp);
    }

    public lateUpdate(): void {
        this.nShadowmaps = 0;

        const lights: ILightData[] = [];
        //tmp matrices
        const proj = mat4.create();
        const tmp = vec4.create();

        for (const [l, e] of this.components) {
            if (l.lightInfo.intensity < 0.001) continue;
            const t = e.transform;
            let shadowMap = -1;
            let vp: Mat4 | undefined;

            if (l.lightInfo.castShadows && l.lightInfo.type != "point") {
                shadowMap = this.nShadowmaps++;

                vp = new Float32Array(
                    this.lightVPMat,
                    this.matrixAlignedSize * shadowMap,
                    16
                );

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
                    mat4.perspective(
                        l.lightInfo.outerCone * 2,
                        1,
                        0.01,
                        l.lightInfo.maxRange,
                        proj
                    );
                }

                mat4.mul(proj, t.$glbInvMtx, vp);
            }

            vec4.transformMat4([0, 0, -1, 0], t.$glbMtx, tmp);
            lights.push({
                position: mat4.getTranslation(t.$glbMtx),
                direction: [tmp[0], tmp[1], tmp[2]],
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
        this.nLights = lights.length;

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
