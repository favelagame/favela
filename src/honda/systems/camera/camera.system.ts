import { mat4, quat, vec3 } from "wgpu-matrix";

import { Entity, System, TransformComponent } from "@/honda/core";
import { CameraComponent } from "./camera.component";

export class CameraSystem extends System {
    public componentsRequired = new Set([TransformComponent, CameraComponent]);

    public activeCamera: CameraComponent = null!;
    public activeCameraTransfrom: TransformComponent = null!;

    public viewProjMtxInv = mat4.identity();
    public viewProjMtx = mat4.identity();
    public viewMtx = mat4.identity();
    public viewMtxInv = mat4.identity();

    public update(entities: Set<Entity>): void {
        for (const ent of entities) {
            const comps = this.ecs.getComponents(ent);
            const cc = comps.get(CameraComponent);
            if (!cc.active) continue;
            const tc = comps.get(TransformComponent);
            this.activeCamera = cc;
            this.activeCameraTransfrom = tc;

            // V = T^-1
            mat4.fromQuat(quat.inverse(tc.rotation), this.viewMtx);
            mat4.translate(
                this.viewMtx,
                vec3.negate(tc.translation),
                this.viewMtx
            );

            // V^-1 = T
            mat4.translation(tc.translation, this.viewMtxInv);
            mat4.multiply(this.viewMtxInv, mat4.fromQuat(tc.rotation), this.viewMtxInv);

            // VP = P * V
            mat4.multiply(cc.projMtx, this.viewMtx, this.viewProjMtx);

            // (VP)^-1 = V^-1 * P^-1
            mat4.mul(this.viewMtxInv, cc.projMtxInv, this.viewProjMtxInv);
            break;
        }
    }
}
