import {
    CameraComponent,
    CameraSystem,
    ECS,
    EcsInjectable,
    Game,
    HondaBehavior,
    ScriptComponent,
    ScriptSystem,
    TransformComponent,
} from "@/honda/core";
import { quat, vec3 } from "wgpu-matrix";

import { clamp, PI_2 } from "@/honda/util";
import {
    MeshComponent,
    MeshRendererSystem,
} from "@/honda/systems/meshRenderer";
import { setStatus } from "@/honda/util/status";
import { Gltf } from "@/honda/util/gltf";
import { GpuMeshV1 } from "@/honda/gpu/meshes/basic.mesh";
import { GpuTexturedMeshV1 } from "@/honda/gpu/meshes/textured.mesh";

const sens = 0.005;
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
        this.pitch = clamp(
            -PI_2,
            this.pitch + Game.input.mouseDeltaY * -sens,
            PI_2
        );
        this.yaw += Game.input.mouseDeltaX * -sens; // maybe modulo this one?
        quat.fromEuler(this.pitch, this.yaw, 0, "yxz", this.transform.rotation);

        this.moveBaseVec[0] =
            (Game.input.btnMap["KeyD"] ? 1 : 0) +
            (Game.input.btnMap["KeyA"] ? -1 : 0);
        this.moveBaseVec[1] = 0;
        this.moveBaseVec[2] =
            (Game.input.btnMap["KeyW"] ? -1 : 0) +
            (Game.input.btnMap["KeyS"] ? 1 : 0);

        if (this.moveBaseVec[0] != 0 || this.moveBaseVec[2] != 0) {
            vec3.normalize(this.moveBaseVec, this.moveBaseVec);
            vec3.mulScalar(
                this.moveBaseVec,
                (Game.deltaTime / 1000) * (Game.input.btnMap["ShiftLeft"] ? 5 : 1),
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

    const m1 = await Gltf.fromUrl("m1.glb");
    const gm = new GpuMeshV1(m1.getMeshDataV1(0));
    gm.upload(); // Let's leak a few KiB's of GPU memory

    const m2 = await Gltf.fromUrl("m2.glb");
    await m2.prepareImages();
    const gm2 = new GpuTexturedMeshV1(m2.getTexturedMeshV1(0));
    gm2.upload(); // Let's leak more GPU memory

    const sponza = await Gltf.fromUrl("sponza.glb");
    await sponza.prepareImages();

    ecs.addSystem(new ScriptSystem());
    ecs.addSystem(new CameraSystem());
    ecs.addSystem(
        new MeshRendererSystem(vec3.normalize(vec3.create(-1, 2, 3)))
    );

    const camera = ecs.addEntity();
    ecs.addComponent(camera, new TransformComponent(vec3.create(0, 1, 5)));
    ecs.addComponent(camera, new CameraComponent(70, 0.01, 100));
    ecs.addComponent(camera, new ScriptComponent(FlyCameraScript));
    // ecs.addComponent(camera, new ScriptComponent(RotationScript));

    const meshCache: Partial<Record<number, GpuMeshV1>> = {};
    for (const node of sponza.json.nodes) {
        if (node.matrix) continue;
        if (!node.mesh) continue;

        const e = ecs.addEntity();

        let mesh = meshCache[node.mesh];
        if (!mesh) {
            meshCache[node.mesh] = mesh = new GpuTexturedMeshV1(
                sponza.getTexturedMeshV1(node.mesh)
            );
        }

        ecs.addComponent(
            e,
            new TransformComponent(
                vec3.create(...(node.translation ?? [0, 0, 0])),
                quat.create(...(node.rotation ?? [0, 0, 0, 1])),
                vec3.create(...(node.scale ?? [1, 1, 1]))
            )
        );

        ecs.addComponent(e, new MeshComponent(mesh, 1, 1, 1));
    }

    Object.values(meshCache).forEach((x) => x?.upload());
}
