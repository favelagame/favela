import {
    DynamicAABBColider,
    Game,
    NavSystem,
    SceneNode,
    Script,
} from "@/honda";
import { Point } from "@/honda/lib/nav2d";
import { quat } from "wgpu-matrix";

export class EnemyScript extends Script {
    protected _health: number = Infinity;
    protected _maxHealth: number = Infinity;

    protected _player: SceneNode | null = null;
    protected _pathRecomputeTime: number = 0.1;
    protected _navSys: NavSystem | null = null;
    protected _path: number[][] = [];
    protected _activePoint: number[] | null = null;
    protected _previousFramePos: number[] = [0, 0, 0];
    protected _speed: number = 15;

    public name: string;

    constructor(health: number = Infinity, name: string = "EnemyScript") {
        super();
        this._health = health;
        this._maxHealth = health;
        this.name = name;
    }

    public onAttach(): void {
        this._player = Game.scene.assertChildWithName("Player");
        this._navSys = Game.ecs.getSystem(NavSystem);
    }

    override update(): void {
        if (this._health <= 0) {
            this.node.destroy();
            return;
        }

        // Path recalculation logic
        if (this._pathRecomputeTime > 0.1) {
            const enemyPos =
                this.node.assertComponent(DynamicAABBColider).position;
            const playerPos =
                this._player!.assertComponent(DynamicAABBColider).position;

            // Get path and map points correctly
            const path =
                this._navSys!.getPath(
                    [enemyPos[0], enemyPos[2]],
                    [playerPos[0], playerPos[2]]
                ) ?? [];
            //@ts-expect-error ermm
            this._path = path.map((point: Point) => [point.x, point.y]);

            this._activePoint = this._path.shift() || null;
            this._pathRecomputeTime = 0;
        }

        const collider = this.node.assertComponent(DynamicAABBColider);

        if (this._activePoint) {
            const dx = this._activePoint[0] - collider.position[0];
            const dz = this._activePoint[1] - collider.position[2];
            const distance = Math.sqrt(dx ** 2 + dz ** 2);

            if (distance > 0.1) {
                const forceX = (dx / distance) * this._speed;
                const forceZ = (dz / distance) * this._speed;
                collider.forces[0] = forceX;
                collider.forces[2] = forceZ;

                const targetAngle = Math.atan2(dx, dz);
                quat.fromEuler(
                    0,
                    targetAngle,
                    0,
                    "xyz",
                    this.node.transform.rotation
                );
                this.node.transform.update();
            } else {
                this._activePoint = this._path.shift() || null;
                collider.forces[0] = 0;
                collider.forces[2] = 0;
            }
        }

        this._previousFramePos = [...collider.position];
        this._pathRecomputeTime += Game.deltaTime;
    }

    public damage(damage: number): void {
        this._health -= damage;
    }
}
