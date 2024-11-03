import { quat, vec3 } from "wgpu-matrix";
import {
    ECS,
    Game,
    TransformComponent,
    ScriptSystem,
    ScriptComponent,
    EcsInjectable,
    CubeComponent,
    CubeRendererSystem,
    HondaBehavior,
    CameraComponent,
    CameraSystem,
    Entity,
} from "@/honda/core";
import { clamp, PI_2 } from "./honda/util/math";

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

@EcsInjectable()
class SpawnerScript extends HondaBehavior {
    protected suicide = 0;

    constructor(protected eid: number) {
        super();
        this.suicide = Game.time + 50000;
    }

    onUpdate(): void {
        const t = Game.time;
        const nEnt = this.ecs.addEntity();
        this.ecs.addComponent(
            nEnt,
            new TransformComponent(
                vec3.create(
                    (Math.random() - 0.5) * 10,
                    0.1,
                    (Math.random() - 0.5) * 10
                ),
                undefined,
                vec3.create(0.01, 0.4, 0.01)
            )
        );

        this.ecs.addComponent(nEnt, new CubeComponent(1, 1, 1));
        if (t > this.suicide) this.ecs.removeEntity(this.eid);
    }
}

const sens = 0.005;

@EcsInjectable()
class FlyCameraScript extends HondaBehavior {
    protected pitch = 0;
    protected yaw = 0;

    constructor(
        protected eid: number,
        protected transform: TransformComponent
    ) {
        super();
    }

    protected moveBaseVec = vec3.create(0, 0, 0);

    onUpdate(): void {
        this.pitch = clamp(
            -PI_2,
            this.pitch + Game.input.mouseDeltaY * -sens,
            PI_2
        );
        this.yaw += Game.input.mouseDeltaX * -sens; // maybe modulo this one?
        quat.fromEuler(this.pitch, this.yaw, 0, "yxz", this.transform.rotation);

        this.moveBaseVec[0] =
            (Game.input.btnMap["KeyD"] ? 1 : 0) +
            (Game.input.btnMap["KeyA"] ? -1 : 0);
        this.moveBaseVec[1] = 0;
        this.moveBaseVec[2] =
            (Game.input.btnMap["KeyW"] ? -1 : 0) +
            (Game.input.btnMap["KeyS"] ? 1 : 0);

        if (this.moveBaseVec[0] != 0 || this.moveBaseVec[2] != 0) {
            vec3.normalize(this.moveBaseVec, this.moveBaseVec);
            vec3.mulScalar(
                this.moveBaseVec,
                Game.deltaTime / 1000,
                this.moveBaseVec
            );

            vec3.transformQuat(
                this.moveBaseVec,
                this.transform.rotation,
                this.moveBaseVec
            );

            vec3.add(
                this.transform.translation,
                this.moveBaseVec,
                this.transform.translation
            );
        }

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
    ecs.addComponent(camera, new ScriptComponent(FlyCameraScript));
    // ecs.addComponent(camera, new ScriptComponent(RotationScript));

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
    ecs.addComponent(tower1, new CubeComponent(0.8, 0.8, 0.8));

    const tower2 = ecs.addEntity();
    ecs.addComponent(
        tower2,
        new TransformComponent(
            vec3.create(-0.7, 2, 0),
            quat.identity() as Float32Array,
            vec3.create(0.5, 2, 0.5)
        )
    );
    ecs.addComponent(tower2, new CubeComponent(0.8, 0.8, 0.8));

    const floor = ecs.addEntity();
    ecs.addComponent(
        floor,
        new TransformComponent(
            vec3.create(),
            quat.identity() as Float32Array,
            vec3.create(5, 0.01, 5)
        )
    );
    ecs.addComponent(floor, new CubeComponent(0.8, 0.8, 0.8));

    const planeBody = ecs.addEntity();
    ecs.addComponent(
        planeBody,
        new TransformComponent(
            vec3.create(0, 2.5, 0),
            quat.identity() as Float32Array,
            vec3.create(1, 0.1, 0.1)
        )
    );
    ecs.addComponent(planeBody, new CubeComponent(1.5, 1.5, 1.5));
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
    ecs.addComponent(planeWings, new CubeComponent(1.5, 1.5, 1.5));
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
    ecs.addComponent(explosion, new CubeComponent(2, 1.5, 0.3));
    ecs.addComponent(explosion, new ScriptComponent(ExplosionScript));

    const spawner = ecs.addEntity();
    ecs.addComponent(spawner, new ScriptComponent(SpawnerScript));
}
