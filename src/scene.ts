import { createTextureFromImages } from "webgpu-utils";
import { Game, ScriptComponent, SoundEmmiter, SoundSystem } from "./honda";
import { SceneNode } from "./honda/core/node";
import { CameraComponent } from "./honda/systems/camera";
import { GltfBinary } from "./honda/util/gltf";
import { quat, vec3 } from "wgpu-matrix";
import { Script } from "@/honda";
import { clamp, PI_2 } from "./honda/util";
import {
    DynamicAABBColider,
    StaticAABBColider,
} from "./honda/systems/physics/colider.component";

// basic deadzone
function dz(x: number) {
    return Math.abs(x) < 0.1 ? 0 : x;
}

const sens = 0.0009;
const sensGamepad = 0.05;

class PlayerMoveScript extends Script {
    protected moveBaseVec = vec3.create(0, 0, 0);
    protected pitch = 0;
    protected yaw = 0;

    override update(): void {
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

        this.node.components
            .filter((x) => x instanceof DynamicAABBColider)
            .forEach((x) => {
                (x as DynamicAABBColider).forces[0] += moveVec[0];
                (x as DynamicAABBColider).forces[2] += moveVec[2];
            });
    }
}

class PosastMoveScript extends Script {
    protected moveBaseVec = vec3.create(-1, 0, 0);

    override update(): void {
        this.node.transform.translation[0] += this.moveBaseVec[0] * 0.01;
    }
}

export async function createScene() {
    // const gltfScene = await GltfBinary.fromUrl("./scenetest.glb");
    const gltfScene = await GltfBinary.fromUrl("./collisiontest.glb");
    // const gltfScene = await GltfBinary.fromUrl("./Sponza5.glb");
    const alienation = await GltfBinary.fromUrl("./Alienation.glb");

    const fakingPosastBrt = alienation.nodeConvert(0);
    fakingPosastBrt.transform.scale.set([0.8, 0.8, 0.8]);
    fakingPosastBrt.transform.translation.set([8, 0, 0]);
    fakingPosastBrt.transform.update();
    fakingPosastBrt.addComponent(new SoundEmmiter("beep", "Beep Sound", 0.5));
    fakingPosastBrt.addComponent(new ScriptComponent(new PosastMoveScript()));
    Game.scene.addChild(fakingPosastBrt);

    console.log(gltfScene);

    Game.scene.addChild(gltfScene.sceneAsNode());
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
        "beep": "audio/beep.mp3"
    });

    const sc = new SceneNode();
    sc.name = "staticColiders";

    sc.addComponent(new StaticAABBColider([-12, -1, -12], [12, 0, 12], 1));

    sc.addComponent(new StaticAABBColider([-12, 0, -12], [-10, 4, 12], 1));
    sc.addComponent(new StaticAABBColider([10, 0, -12], [12, 4, 12], 1));
    sc.addComponent(new StaticAABBColider([-12, 0, -12], [12, 4, -10], 1));

    sc.addComponent(new StaticAABBColider([-12, 0, 10], [12, 4, 12], 1));

    const camera = new SceneNode();
    camera.name = "Player";
    camera.addComponent(new CameraComponent(70, 0.1, 32, "MainCamera"));
    camera.addComponent(new DynamicAABBColider([0, 15, 0], [0.5, 2, 0.5], 1));
    camera.addComponent(new ScriptComponent(new PlayerMoveScript()));

    // play through components
    fakingPosastBrt.components.filter((x) => x instanceof SoundEmmiter).forEach((x) => {
        x.setLoop(true);
        x.play();
    });

    // play throu system
    // Game.ecs.getSystem(SoundSystem).playAudio("beep1", "beep", true);

    Game.scene.addChild(camera);

    console.log(Game.scene.tree());

    return { skyTex };
}
