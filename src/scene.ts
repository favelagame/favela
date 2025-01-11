import { createTextureFromImages } from "webgpu-utils";
import { Game, LightComponent, ScriptComponent } from "./honda";
import { SceneNode } from "./honda/core/node";
import { CameraComponent } from "./honda/systems/camera";
import { GltfBinary } from "./honda/util/gltf";
import { quat, vec3 } from "wgpu-matrix";
import { Script } from "@/honda";
import { clamp, nn, PI_2 } from "./honda/util";
import {
    DynamicAABBColider,
    LAYER_ENEMY,
    LAYER_PHYSICS,
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
                (x as DynamicAABBColider).forces[0] = moveVec[0];
                (x as DynamicAABBColider).forces[2] = moveVec[2];
            });
    }
}

export async function createScene() {
    const alienation = await GltfBinary.fromUrl("./Alienation.glb");
    const sponzaScene = await GltfBinary.fromUrl("./SponzaScene.glb");

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

    console.log(Game.scene.tree());
    return { skyTex };
}
