import {
    CameraComponent,
    CameraSystem,
    ECS,
    EcsInjectable,
    Game,
    HondaBehavior,
    MeshComponent,
    MeshSystem,
    ScriptComponent,
    ScriptSystem,
    TransformComponent,
} from "@/honda/core";
import { quat, vec3 } from "wgpu-matrix";

import { clamp, PI_2 } from "@/honda/util";
import { setStatus } from "@/honda/util/status";
import { GltfBinary } from "@/honda/util/gltf";
import { createTextureFromImages } from "webgpu-utils";

// basic deadzone
function dz(x: number) {
    return Math.abs(x) < 0.1 ? 0 : x;
}

const sens = 0.005;
const sensGamepad = 0.05;

@EcsInjectable()
class FlyCameraScript extends HondaBehavior {
    protected moveBaseVec = vec3.create(0, 0, 0);
    protected pitch = 0;

    protected yaw = 0;

    constructor(
        protected eid: number,
        protected transform: TransformComponent
    ) {
        super();
    }

    onUpdate(): void {
        let boost = false;
        const g = Game.input.activeGamepad;

        if (g) {
            boost = g.buttons[0].pressed;
            this.moveBaseVec[0] = dz(g.axes[0]);
            this.moveBaseVec[1] = 0;
            this.moveBaseVec[2] = dz(g.axes[1]);

            this.pitch = clamp(
                -PI_2,
                this.pitch + dz(g.axes[3]) * -sensGamepad,
                PI_2
            );
            this.yaw += dz(g.axes[2]) * -sensGamepad; // maybe modulo this one?
            quat.fromEuler(
                this.pitch,
                this.yaw,
                0,
                "yxz",
                this.transform.rotation
            );
        } else {
            boost = Game.input.btnMap["ShiftLeft"];
            this.moveBaseVec[0] =
                (Game.input.btnMap["KeyD"] ? 1 : 0) +
                (Game.input.btnMap["KeyA"] ? -1 : 0);
            this.moveBaseVec[1] = 0;
            this.moveBaseVec[2] =
                (Game.input.btnMap["KeyW"] ? -1 : 0) +
                (Game.input.btnMap["KeyS"] ? 1 : 0);

            this.pitch = clamp(
                -PI_2,
                this.pitch + Game.input.mouseDeltaY * -sens,
                PI_2
            );
            this.yaw += Game.input.mouseDeltaX * -sens; // maybe modulo this one?
            quat.fromEuler(
                this.pitch,
                this.yaw,
                0,
                "yxz",
                this.transform.rotation
            );
        }

        if (this.moveBaseVec[0] != 0 || this.moveBaseVec[2] != 0) {
            if (vec3.length(this.moveBaseVec) > 1) {
                vec3.normalize(this.moveBaseVec, this.moveBaseVec);
            }
            vec3.mulScalar(
                this.moveBaseVec,
                (Game.deltaTime / 1000) * (boost ? 5 : 1),
                this.moveBaseVec
            );

            vec3.transformQuat(
                this.moveBaseVec,
                this.transform.rotation,
                this.moveBaseVec
            );

            vec3.add(
                this.transform.translation,
                this.moveBaseVec,
                this.transform.translation
            );
        }

        this.transform.updateMatrix();
    }
}

export async function setupScene(ecs: ECS) {
    setStatus("loading assets");

    const skyTex = await createTextureFromImages(
        Game.gpu.device,
        [
            "sky/px.avif",
            "sky/nx.avif",
            "sky/pyh.avif",
            "sky/ny.avif",
            "sky/pz.avif",
            "sky/nz.avif",
        ],
        { mips: true }
    );

    const sponza = await GltfBinary.fromUrl("Sponza4.glb");

    ecs.addSystem(new ScriptSystem());
    ecs.addSystem(new CameraSystem());
    ecs.addSystem(new MeshSystem());

    const camera = ecs.addEntity();
    ecs.addComponent(camera, new TransformComponent(vec3.create(0, 1, 5)));
    ecs.addComponent(camera, new CameraComponent(70, 0.01, 100));
    ecs.addComponent(camera, new ScriptComponent(FlyCameraScript));

    console.time("wastingTimeUploadingToGPU");

    const scene = sponza.defaultScene();
    console.log(scene);

    const meshNodes = [];
    for (const nodeIdx of scene.nodes ?? []) {
        const node = sponza.json.nodes![nodeIdx]!;
        if (node.matrix) continue;
        if (typeof node.mesh !== "number") continue;

        if (node.children) {
            console.log(node.children);
        }

        meshNodes.push(node.name ?? "<unk>");

        const me = sponza.getMesh(node.mesh);
        const ma = sponza.getMeshMaterial(node.mesh);

        const eidx = ecs.addEntity();
        ecs.addComponent(
            eidx,
            new TransformComponent(
                vec3.fromValues(...(node.translation ?? [0, 0, 0])),
                quat.fromValues(...(node.rotation ?? [0, 0, 0, 1])),
                vec3.fromValues(...(node.scale ?? [1, 1, 1]))
            )
        );
        ecs.addComponent(eidx, new MeshComponent(me, ma));
    }
    console.timeEnd("wastingTimeUploadingToGPU");
    console.log(meshNodes);

    return {
        skyTex,
    };
}
