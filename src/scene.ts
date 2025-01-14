import { quat, vec3 } from "wgpu-matrix";
import { createTextureFromImages } from "webgpu-utils";
import {
    Game,
    NavSystem,
    SoundSystem,
    LightComponent,
    ScriptComponent,
    SceneNode,
    CameraComponent,
    GltfBinary,
    DynamicAABBColider,
    LAYER_ENEMY,
    LAYER_PHYSICS,
    LAYER_PICKUP,
    StaticAABBColider,
} from "@/honda";

import { PlayerScript } from "./scripts/player.script";
import { EnemyScript } from "./scripts/enemy.script";
import { nn } from "./honda/util";

export async function createScene() {
    const croshair = new Image();
    croshair.src = "crosshair.svg";
    croshair.id = "crosshair";
    document.querySelector("body")!.appendChild(croshair);

    document.querySelector("#game-ui")!.setAttribute("style", "opacity: 1");

    // const main = await GltfBinary.fromUrl("./levelzero.glb");
    const main = await GltfBinary.fromUrl("./levelzero_w.glb");
    const pickups = await GltfBinary.fromUrl("./pickups.glb");
    const alienation = await GltfBinary.fromUrl("./Alienation.glb");

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
        pickup: "audio/equip.mp3",
        gunClick: "audio/gun_click.ogg",
        reload: "audio/reload.ogg",
        gunShot: "audio/gun_shot.ogg",
        breathe: "audio/breathe.ogg",
        door: "audio/door.mp3"
    });

    {
        Game.scene.addChild(main.sceneAsNode());
        const coliders = new SceneNode();
        coliders.name = "StaticColiders";
        main.getStaticColiders().forEach((x) => coliders.addComponent(x));
        Game.scene.addChild(coliders);
    }

    const pois = main.getAllPOIs().filter((x) => x.props["monster"]);
    console.log(pois);

    const makeEnemys = () => {
        for (const poi of pois) {
            const fakingPosastBrt = new SceneNode();
            fakingPosastBrt.name = `Mnstr:${name}`;
            fakingPosastBrt.addComponent(
                new DynamicAABBColider(
                    poi.position,
                    [0.3, 2, 0.3],
                    LAYER_ENEMY | LAYER_PHYSICS
                )
            );
            fakingPosastBrt.addComponent(
                new ScriptComponent(new EnemyScript(100))
            );
            fakingPosastBrt.transform.update();

            const alienationN = nn(alienation.nodeConvert(0), "posast ni bla");
            alienationN.transform.scale.set([0.6, 0.6, 0.6]);
            alienationN.transform.update();
            alienationN.transform.translation.set([0, -1, 0]);
            alienationN.transform.update();
            fakingPosastBrt.addChild(alienationN);

            Game.scene.addChild(fakingPosastBrt);
        }
    };

    {
        const player = new SceneNode();
        player.name = "Player";
        player.addComponent(
            new DynamicAABBColider(
                main.getPOIByName("PlayerSpawn")!.position!,
                [0.5, 1.75, 0.5],
                1
            )
        );
        player.addComponent(new ScriptComponent(new PlayerScript(makeEnemys)));

        const camera = new SceneNode();
        camera.name = "Camera";
        camera.addComponent(new CameraComponent(70, 0.1, 32, "MainCamera"));
        player.addChild(camera);

        const ln = new SceneNode();
        ln.name = "lightholder";
        ln.transform.translation.set([0, 0, -0.1]);
        ln.transform.rotation.set([0, -0.03, 0, 1]);
        ln.transform.update();
        ln.addComponent(
            new LightComponent({
                castShadows: true,
                color: [1, 1, 1],
                type: "spot",
                intensity: 0,
                innerCone: 0.3,
                outerCone: 0.5,
                maxRange: 24,
            })
        );
        player.addChild(ln);

        Game.scene.addChild(player);
    }

    {
        const pickupPoi = main.getPOIByName("PickupLight")!;
        const pickup = pickups.nodeConvert(0)!;
        pickup.name = "PickupLight";
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
        const pickupPoi = main.getPOIByName("PickupPistol")!;
        const pickup = pickups.nodeConvert(1)!;
        pickup.name = "PickupPistol";
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
        const navmesh = main.getNavmesh();
        Game.ecs.getSystem(NavSystem).setNavmesh(navmesh);
    } catch (e) {
        console.warn("navmesh load failed", e);
    }

    console.log(Game.scene.tree());

    return { skyTex };
}
