import { quat, vec3 } from "wgpu-matrix";

import {
    ECS,
    Game,
    TransformComponent,
    ScriptSystem,
    ScriptComponent,
    EcsInjectable,
} from "@/honda/core";
import {
    CCubeRendererComponent,
    CubeRendererSystem,
} from "@/honda/systems/cubeRenderer";
import { HondaBehavior } from "@/honda/systems/script/hondaBehavior.class";
import { CameraComponent, CameraSystem } from "./honda/systems/cameraSystem";

@EcsInjectable()
class FlyScript extends HondaBehavior {
    constructor(public eid: number, public transform: TransformComponent) {
        super();
    }

    override onUpdate(): void {
        const ax = Game.input.activeGamepad?.axes[0];
        const t = ax != undefined ? ax * (Math.PI / 2) + 3.6 : Game.time / 1000;
        this.transform.translation[0] = 2.5 * Math.sin(t) + 4;
        this.transform.updateMatrix();
    }
}

@EcsInjectable()
class ExplosionScript extends HondaBehavior {
    constructor(public eid: number, public transform: TransformComponent) {
        super();
    }

    override onUpdate(): void {
        const ax = Game.input.activeGamepad?.axes[0];
        const t = ax != undefined ? ax * (Math.PI / 2) + 3.6 : Game.time / 1000;
        this.transform.scale[0] =
            this.transform.scale[1] =
            this.transform.scale[2] =
                Math.max(Math.tan(t / 2 + Math.PI / 2), 0);
        this.transform.updateMatrix();
    }
}

@EcsInjectable()
class RotationScript extends HondaBehavior {
    protected q = quat.fromEuler(0, 0.01, 0, "xyz");
    protected qd = quat.create();

    constructor(public eid: number, public transform: TransformComponent) {
        super();
    }

    override onUpdate(): void {
        // console.log(this.transform.rotation)
        quat.mulScalar(this.q, Game.deltaTime / 1000, this.qd);
        quat.mul(this.transform.rotation, this.q, this.transform.rotation);
        this.transform.updateMatrix();
    }
}

export function setupScene(ecs: ECS) {
    ecs.addSystem(new ScriptSystem());
    ecs.addSystem(new CameraSystem());
    ecs.addSystem(
        new CubeRendererSystem(vec3.normalize(vec3.create(-1, 2, 3)))
    );

    const camera = ecs.addEntity();
    ecs.addComponent(camera, new TransformComponent(vec3.create(0, 1, 5)));
    ecs.addComponent(camera, new CameraComponent(70, 0.01, 100));
    ecs.addComponent(camera, new ScriptComponent(RotationScript));

    const tower1 = ecs.addEntity();
    ecs.addComponent(
        tower1,
        new TransformComponent(
            vec3.create(0.7, 2, 0),
            quat.identity() as Float32Array,
            vec3.create(0.5, 2, 0.5)
        )
    );
    ecs.addComponent(tower1, new ScriptComponent(RotationScript));
    ecs.addComponent(tower1, new CCubeRendererComponent(0.8, 0.8, 0.8));

    const tower2 = ecs.addEntity();
    ecs.addComponent(
        tower2,
        new TransformComponent(
            vec3.create(-0.7, 2, 0),
            quat.identity() as Float32Array,
            vec3.create(0.5, 2, 0.5)
        )
    );
    ecs.addComponent(tower2, new CCubeRendererComponent(0.8, 0.8, 0.8));

    const floor = ecs.addEntity();
    ecs.addComponent(
        floor,
        new TransformComponent(
            vec3.create(),
            quat.identity() as Float32Array,
            vec3.create(5, 0.01, 5)
        )
    );
    ecs.addComponent(floor, new CCubeRendererComponent(0.8, 0.8, 0.8));

    const planeBody = ecs.addEntity();
    ecs.addComponent(
        planeBody,
        new TransformComponent(
            vec3.create(0, 2.5, 0),
            quat.identity() as Float32Array,
            vec3.create(1, 0.1, 0.1)
        )
    );
    ecs.addComponent(planeBody, new CCubeRendererComponent(1.5, 1.5, 1.5));
    ecs.addComponent(planeBody, new ScriptComponent(FlyScript));

    const planeWings = ecs.addEntity();
    ecs.addComponent(
        planeWings,
        new TransformComponent(
            vec3.create(0, 2.5, 0),
            quat.identity() as Float32Array,
            vec3.create(0.2, 0.05, 1)
        )
    );
    ecs.addComponent(planeWings, new CCubeRendererComponent(1.5, 1.5, 1.5));
    ecs.addComponent(planeWings, new ScriptComponent(FlyScript));

    const explosion = ecs.addEntity();
    ecs.addComponent(
        explosion,
        new TransformComponent(
            vec3.create(0.7, 2, 0),
            quat.fromEuler<Float32Array>(0.5, 0.4, 0.6, "xyz"),
            vec3.create(1, 1, 1)
        )
    );
    ecs.addComponent(explosion, new CCubeRendererComponent(2, 1.5, 0.3));
    ecs.addComponent(explosion, new ScriptComponent(ExplosionScript));
}
