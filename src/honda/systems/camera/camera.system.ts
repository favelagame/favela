import { mat4 } from "wgpu-matrix";
import { CameraComponent } from "./camera.component";
import { System } from "@/honda/core/ecs";
import { SceneNode } from "@/honda/core/scene";

export class CameraSystem extends System {
    public componentType = CameraComponent;

    public activeCamera: CameraComponent = null!;

    public viewProjMtxInv = mat4.identity();
    public viewProjMtx = mat4.identity();
    public viewMtx = mat4.identity();
    public viewMtxInv = mat4.identity();

    protected components = new Map<CameraComponent, SceneNode>();

    public componentCreated(node: SceneNode, comp: CameraComponent) {
        if (this.components.delete(comp)) {
            console.warn("moved component to new node", comp, node);
        }
        this.components.set(comp, node);
    }

    public componentDestroyed(_: SceneNode, comp: CameraComponent) {
        this.components.delete(comp);
    }

    public lateUpdate(): void {
        const activeCamera = this.components.entries().find(([c]) => c.active);
        if (!activeCamera) return;
        const cc = (this.activeCamera = activeCamera[0]);
        const tc = activeCamera[1].transform;

        // V = T^-1
        this.viewMtx.set(tc.$glbInvMtx);

        // V^-1 = T
        this.viewMtxInv.set(tc.$glbMtx);

        // VP = P * V
        mat4.multiply(cc.projMtx, this.viewMtx, this.viewProjMtx);

        // (VP)^-1 = V^-1 * P^-1
        mat4.mul(this.viewMtxInv, cc.projMtxInv, this.viewProjMtxInv);
    }
}
