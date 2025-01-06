import { Game } from "./honda/core";
import { GltfBinary } from "./honda/util/gltf";

export async function createScene() {
    const gltfScene = await GltfBinary.fromUrl("./scenetest.glb");

    Game.scene.addChild(gltfScene.sceneAsNode());

    console.log(Game.scene.tree());
}
