import { ECS, Game, CTransform, ScriptSystem, CScript } from "./honda/core";
import {
    CCubeRenderer,
    CubeRendererSystem,
} from "./honda/systems/cubeRenderer";
import { mat4, quat, vec3 } from "wgpu-matrix";

function getProjectionMatrix(
    aspectRatio: number,
    fovY: number,
    near: number,
    far: number
) {
    // Perspective projection matrix
    const proj = mat4.perspective(fovY, aspectRatio, near, far);

    // Camera position and target
    const eye = vec3.create(1.5, 4, 5);
    const target = vec3.create(0, 1, 0);
    const up = vec3.create(0, 1, 0);

    // View matrix (camera transformation)
    const view = mat4.lookAt(eye, target, up);

    // Return combined view-projection matrix
    return mat4.multiply(proj, view);
}

export function setupScene(ecs: ECS) {
    const aspect = Game.gpu.canvas.width / Game.gpu.canvas.height;
    ecs.addSystem(new ScriptSystem());
    ecs.addSystem(
        new CubeRendererSystem(
            getProjectionMatrix(aspect, (2 * Math.PI) / 5, 0.01, 100),
            vec3.normalize(vec3.create(-1, 2, 3))
        )
    );

    {
        const cube = ecs.addEntity();
        const ct = new CTransform();
        ct.translation.set([0.7, 2, 0]);
        ct.scale.set([0.5, 2, 0.5]);
        ct.updateMatrix();

        ecs.addComponent(cube, ct);
        ecs.addComponent(cube, new CCubeRenderer(0.8, 0.8, 0.8));
    }

    {
        const cube = ecs.addEntity();
        const ct = new CTransform();
        ct.translation.set([-0.7, 2, 0]);
        ct.scale.set([0.5, 2, 0.5]);
        ct.updateMatrix();

        ecs.addComponent(cube, ct);
        ecs.addComponent(cube, new CCubeRenderer(0.8, 0.8, 0.8));
    }

    {
        const cube = ecs.addEntity();
        const ct = new CTransform();
        ct.scale.set([5, 0.01, 5]);
        ct.updateMatrix();

        ecs.addComponent(cube, ct);
        ecs.addComponent(cube, new CCubeRenderer(0.8, 0.8, 0.8));
    }
    // {
    //     const cube = ecs.addEntity();
    //     ecs.addComponent(cube, new CTransform());
    //     ecs.addComponent(cube, new CCubeRenderer(1, 0, 0.5));
    // }

    const flyScript = new CScript((eid, ecs) => {
        const transform = ecs.getComponents(eid).get(CTransform);
        const t = Game.time / 1000;

        transform.translation[0] = 2.5 * Math.sin(t) + 4;
        transform.updateMatrix();
    });

    {
        const cube2 = ecs.addEntity();
        const ct = new CTransform();
        ct.translation.set([0, 2.5, 0]);
        ct.scale.set([1, 0.1, 0.1]);
        ct.updateMatrix();
        ecs.addComponent(cube2, ct);
        ecs.addComponent(cube2, new CCubeRenderer(1.5, 1.5, 1.5));
        ecs.addComponent(cube2, flyScript);
    }

    {
        const cube2 = ecs.addEntity();
        const ct = new CTransform();
        ct.translation.set([0, 2.5, 0]);
        ct.scale.set([0.2, 0.05, 1]);
        ct.updateMatrix();
        ecs.addComponent(cube2, ct);
        ecs.addComponent(cube2, new CCubeRenderer(1.5, 1.5, 1.5));
        ecs.addComponent(cube2, flyScript);
    }

    {
        const cube2 = ecs.addEntity();
        const ct = new CTransform();
        ct.translation.set([0.7, 2, 0]);
        ct.scale.set([1, 1, 1]);
        ct.rotation.set(quat.fromEuler(0.5, 0.4, 0.6, "xyz"));
        ct.updateMatrix();
        ecs.addComponent(cube2, ct);
        ecs.addComponent(cube2, new CCubeRenderer(2, 1.5, 0.3));
        ecs.addComponent(
            cube2,
            new CScript((eid, ecs) => {
                const transform = ecs.getComponents(eid).get(CTransform);
                const t = Game.time / 1000;

                transform.scale[0] =
                    transform.scale[1] =
                    transform.scale[2] =
                        Math.max(Math.tan(t / 2 + Math.PI / 2), 0);
                transform.updateMatrix();
            })
        );
    }
}
