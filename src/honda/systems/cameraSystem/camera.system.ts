import { mat4, quat, vec3 } from "wgpu-matrix";

import { Entity, System, TransformComponent } from "@/honda/core";
import { CameraComponent } from "./camera.component";

export class CameraSystem extends System {
    public componentsRequired = new Set([TransformComponent, CameraComponent]);

    public activeCamera: CameraComponent = null!;
    public activeCameraTransfrom: TransformComponent = null!;
    public viewProjectionMatrix = mat4.identity();
    public viewMatrix = mat4.identity();

    public update(entities: Set<Entity>): void {
        for (const ent of entities) {
            const comps = this.ecs.getComponents(ent);
            const cc = comps.get(CameraComponent);
            if (!cc.active) continue;
            const tc = comps.get(TransformComponent);
            this.activeCamera = cc;
            this.activeCameraTransfrom = tc;

            // C^1
            mat4.fromQuat(quat.inverse(tc.rotation), this.viewMatrix);
            mat4.translate(
                this.viewMatrix,
                vec3.negate(tc.translation),
                this.viewMatrix
            );

            // V = P * C^-1
            mat4.multiply(cc.matrix, this.viewMatrix, this.viewProjectionMatrix);
            break;
        }
    }
}
