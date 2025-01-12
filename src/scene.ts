import { createTextureFromImages } from "webgpu-utils";
import { Game, LightComponent, ScriptComponent, SoundSystem } from "./honda";
import { SceneNode } from "./honda/core/node";
import { CameraComponent, CameraSystem } from "./honda/systems/camera";
import { GltfBinary } from "./honda/util/gltf";
import { mat4, quat, vec3, vec4 } from "wgpu-matrix";
import { Script } from "@/honda";
import { clamp, nn, PI_2 } from "./honda/util";
import {
    DynamicAABBColider,
    LAYER_ENEMY,
    LAYER_PHYSICS,
    LAYER_PICKUP,
    LAYER_QUERY,
    StaticAABBColider,
} from "./honda/systems/physics/colider.component";
import { PhysicsSystem } from "./honda/systems/physics/physics.system";
import { NavSystem } from "./honda/systems/nav";

// basic deadzone
function dz(x: number) {
    return Math.abs(x) < 0.1 ? 0 : x;
}

const sens = 0.0009;
const sensGamepad = 0.05;

const forward = vec4.create(0, 0, -1, 0);

class PlayerMoveScript extends Script {
    protected moveBaseVec = vec3.create(0, 0, 0);
    protected pitch = 0;
    protected yaw = 0;

    protected foot = false;
    protected elapsedFoot = 0;

    protected colider!: DynamicAABBColider;
    protected phys!: PhysicsSystem;
    protected cam!: CameraSystem;

    public onAttach(): void {
        this.colider = this.node.assertComponent(DynamicAABBColider);
        this.colider.detectLayers |= LAYER_QUERY | LAYER_PICKUP;
        this.phys = Game.ecs.getSystem(PhysicsSystem);
        this.cam = Game.ecs.getSystem(CameraSystem);
    }

    protected lastRaycast = 0;

    override update(): void {
        let boost = false;
        const g = Game.input.activeGamepad;

        if (Game.input.btnMap["mouse0"] && this.lastRaycast + 1 < Game.time) {
            this.lastRaycast = Game.time;

            console.log(
                this.phys.raycast(
                    mat4.getTranslation(this.node.transform.$glbMtx),
                    vec4.transformMat4(forward, this.node.transform.$glbMtx),
                    0xff,
                    this.colider
                )
            );
        }

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
                this.node.transform.rotation
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
                this.node.transform.rotation
            );
        }

        // take camera direction into account
        const moveVec = vec3.create();
        vec3.transformQuat(
            this.moveBaseVec,
            this.node.transform.rotation,
            moveVec
        );
        vec3.normalize(moveVec, moveVec);

        const speedMultiplier = boost ? 40 : 20;

        moveVec[0] *= speedMultiplier;
        moveVec[2] *= speedMultiplier;
        this.colider.forces[0] += moveVec[0];
        this.colider.forces[2] += moveVec[2];
        if (this.colider.onFloor && Game.input.btnMap["Space"]) {
            this.colider.forces[1] += 3000;
        }

        if (this.colider.forces[0] != 0 || this.colider.forces[2] != 0) {
            if (this.elapsedFoot > (boost ? 0.3 : 0.6)) {
                if (this.foot) {
                    if (
                        !Game.ecs.getSystem(SoundSystem).isPlaying("footstepR")
                    ) {
                        Game.ecs
                            .getSystem(SoundSystem)
                            .playAudio("footstepR", false, 1, "footstepR");
                    }
                } else {
                    if (
                        !Game.ecs.getSystem(SoundSystem).isPlaying("footstepL")
                    ) {
                        Game.ecs
                            .getSystem(SoundSystem)
                            .playAudio("footstepL", false, 1, "footstepL");
                    }
                }

                this.foot = !this.foot;
                this.elapsedFoot = 0;
            }
        } else {
            Game.ecs.getSystem(SoundSystem).stopAudio("footstepR");
            Game.ecs.getSystem(SoundSystem).stopAudio("footstepL");
        }

        this.elapsedFoot += Game.deltaTime;
    }

    override lateUpdate(): void {
        // this can also be called in the next frame's update
        for (const c of this.colider.collisions) {
            console.log("coliding", c);
        }
    }
}

export async function createScene() {
    const alienation = await GltfBinary.fromUrl("./Alienation.glb");
    const sponzaScene = await GltfBinary.fromUrl("./SponzaScene.glb");
    const pickups = await GltfBinary.fromUrl("./pickups.glb");

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

    await Game.ecs.getSystem(SoundSystem).loadAudioFiles({
        beep: "audio/beep.mp3",
        footstepL: "audio/footstep_L.ogg",
        footstepR: "audio/footstep_R.ogg",
    });

    {
        Game.scene.addChild(sponzaScene.sceneAsNode());
        const coliders = new SceneNode();
        coliders.name = "StaticColiders";
        sponzaScene
            .getStaticColiders()
            .forEach((x) => coliders.addComponent(x));
        Game.scene.addChild(coliders);
    }

    {
        const fakingPosastBrt = nn(alienation.nodeConvert(0), "posast ni bla");
        fakingPosastBrt.transform.scale.set([0.6, 0.6, 0.6]);
        fakingPosastBrt.transform.translation.set(
            sponzaScene.getPOIByName("EnemySpawn")!.position!
        );
        fakingPosastBrt.addComponent(
            new DynamicAABBColider(
                sponzaScene.getPOIByName("EnemySpawn")!.position!,
                [0.5, 2, 0.5], //TODO: fix model offset
                LAYER_ENEMY | LAYER_PHYSICS
            )
        );
        fakingPosastBrt.transform.update();
        Game.scene.addChild(fakingPosastBrt);
    }

    {
        const camera = new SceneNode();
        camera.name = "Player";
        camera.addComponent(new CameraComponent(70, 0.1, 32, "MainCamera"));
        camera.addComponent(
            new DynamicAABBColider(
                sponzaScene.getPOIByName("PlayerSpawn")!.position!,
                [0.5, 2, 0.5],
                1
            )
        );
        camera.addComponent(new ScriptComponent(new PlayerMoveScript()));

        const ln = new SceneNode();
        ln.name = "lightholder";
        ln.transform.translation.set([0.05, -0.2, -0.1]);
        ln.transform.update();
        ln.addComponent(
            new LightComponent({
                castShadows: true,
                color: [1, 1, 1],
                type: "spot",
                intensity: 300, // zlt bom ceu
                innerCone: 0.5,
                outerCone: 0.7,
                maxRange: 15,
            })
        );
        camera.addChild(ln);

        Game.scene.addChild(camera);
    }

    {
        const pickupPoi = sponzaScene.getPOIByName("PickupLight")!;
        const pickup = pickups.nodeConvert(0)!;
        pickup.transform.translation.set(pickupPoi.position);
        quat.fromEuler(
            0,
            Math.PI / 2,
            Math.PI / 2,
            "xyz",
            pickup.transform.rotation
        );
        pickup.transform.scale.set([0.05, 0.05, 0.05]);
        pickup.transform.update();
        pickup.addComponent(
            new StaticAABBColider(
                vec3.sub(pickupPoi.position, [0.1, 0.1, 0.1]),
                vec3.add(pickupPoi.position, [0.1, 0.1, 0.1]),
                LAYER_PICKUP
            )
        );

        Game.scene.addChild(pickup);
    }

    {
        const pickupPoi = sponzaScene.getPOIByName("PickupPistol")!;
        const pickup = pickups.nodeConvert(1)!;
        pickup.transform.translation.set(pickupPoi.position);
        quat.fromEuler(0, 0, Math.PI / 2, "xyz", pickup.transform.rotation);
        pickup.transform.scale.set([0.05, 0.05, 0.05]);
        pickup.transform.update();
        pickup.addComponent(
            new StaticAABBColider(
                vec3.sub(pickupPoi.position, [0.1, 0.1, 0.1]),
                vec3.add(pickupPoi.position, [0.1, 0.1, 0.1]),
                LAYER_PICKUP
            )
        );

        Game.scene.addChild(pickup);
    }

    try {
        const navmesh = sponzaScene.getNavmesh();
        Game.ecs.getSystem(NavSystem).setNavmesh(navmesh);
    } catch (e) {
        console.warn("navmesh load failed", e);
    }

    console.log(Game.scene.tree());

    return { skyTex };
}
