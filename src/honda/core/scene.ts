import { SceneNode } from "./node";

function updateTransforms(n: SceneNode) {
    n.children.forEach((x) => {
        x.transform.$updateGlobal(n.transform);
        updateTransforms(x);
    });
}

export class Scene extends SceneNode {
    constructor() {
        super();
        this.name = "Scene";
    }

    public computeTransforms() {
        updateTransforms(this);
    }
}
