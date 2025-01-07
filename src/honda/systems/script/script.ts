import { SceneNode } from "@/honda";

/* eslint-disable class-methods-use-this */
export abstract class Script {
    private _node!: SceneNode;

    public get node(): SceneNode {
        if (!this._node) {
            throw new Error("Node accesed when Script unnatached");
        }
        return this._node;
    }

    public earlyUpdate() {}
    public update() {}
    public lateUpdate() {}

    public onDetach() {}
    public onAttach() {}
}
