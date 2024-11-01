import { Entity, System } from "@/honda/ecs";
import { CameraComponent } from "./camera.component";
import { TransformComponent } from "../transform";
import { mat4, quat, vec3 } from "wgpu-matrix";

export class CameraSystem extends System {
    public componentsRequired = new Set([TransformComponent, CameraComponent]);

    public viewMatrix = mat4.identity();
    protected cameraInverse = mat4.identity();

    public update(entities: Set<Entity>): void {
        for (const ent of entities) {
            const comps = this.ecs.getComponents(ent);
            const cc = comps.get(CameraComponent);
            if (!cc.active) continue;
            const tc = comps.get(TransformComponent);

            // C^1
            mat4.fromQuat(quat.inverse(tc.rotation), this.cameraInverse);
            mat4.translate(
                this.cameraInverse,
                vec3.negate(tc.translation),
                this.cameraInverse
            );

            // V = P * C^-1
            mat4.multiply(cc.matrix, this.cameraInverse, this.viewMatrix);

        }
    }
}
