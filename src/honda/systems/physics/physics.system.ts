import { System } from "@/honda/core/ecs";
import {
    Colider,
    DynamicAABBColider,
    LAYER_PHYSICS,
    StaticAABBColider,
} from "./colider.component";
import { SceneNode } from "@/honda/core/node";
import { Game } from "@/honda/state";
import { Vec3, vec3 } from "wgpu-matrix";

// ta fajl je kinda in shambles, for some reason tuki useam number[3] namest F32array
// shoutout Ziga Lesar, shoutout random tip iz stack overflowa, shoutout the one book

type V3 = [number, number, number];

type AABB = StaticAABBColider | DynamicAABBColider;

interface IRayHit {
    t: number;

    colider: AABB;
    node: SceneNode;

    rayEntry: Vec3 | V3;
    rayExit: Vec3 | V3;
}

const GRAVITY: V3 = [0, -30, 0];

function rover(mina: number, maxa: number, minb: number, maxb: number) {
    return (
        Math.max(mina, maxa) >= Math.min(minb, maxb) &&
        Math.min(mina, maxa) <= Math.max(minb, maxb)
    );
}

function aabbToAabb(a: AABB, b: AABB) {
    return (
        rover(a.min[0], a.max[0], b.min[0], b.max[0]) &&
        rover(a.min[1], a.max[1], b.min[1], b.max[1]) &&
        rover(a.min[2], a.max[2], b.min[2], b.max[2])
    );
}

function aaabResolve(a: AABB, b: AABB): V3 {
    const da = vec3.sub(b.max, a.min);
    const db = vec3.sub(a.max, b.min);

    let minDiff = Infinity;
    const minDirection: V3 = [0, 0, 0];
    if (da[0] >= 0 && da[0] < minDiff) {
        minDiff = da[0];
        minDirection[1] = minDirection[2] = 0;
        minDirection[0] = minDiff;
    }
    if (da[1] >= 0 && da[1] < minDiff) {
        minDiff = da[1];
        minDirection[0] = minDirection[2] = 0;
        minDirection[1] = minDiff;
    }
    if (da[2] >= 0 && da[2] < minDiff) {
        minDiff = da[2];
        minDirection[0] = minDirection[1] = 0;
        minDirection[2] = minDiff;
    }
    if (db[0] >= 0 && db[0] < minDiff) {
        minDiff = db[0];
        minDirection[1] = minDirection[2] = 0;
        minDirection[0] = -minDiff;
    }
    if (db[1] >= 0 && db[1] < minDiff) {
        minDiff = db[1];
        minDirection[0] = minDirection[2] = 0;
        minDirection[1] = -minDiff;
    }
    if (db[2] >= 0 && db[2] < minDiff) {
        minDiff = db[2];
        minDirection[0] = minDirection[1] = 0;
        minDirection[2] = -minDiff;
    }

    return minDirection;
}

export class PhysicsSystem extends System {
    public componentType = Colider;

    protected allColiders = new Set<AABB>();
    protected reverse = new Map<Colider, SceneNode>();
    protected staticColiders = new Set<StaticAABBColider>();
    protected dynamicColiders = new Set<DynamicAABBColider>();

    public componentCreated(nd: SceneNode, co: Colider): void {
        this.allColiders.add(co as AABB);
        this.reverse.set(co, nd);

        if (co.isStatic) this.staticColiders.add(co as StaticAABBColider);
        else this.dynamicColiders.add(co as DynamicAABBColider);
    }

    public componentDestroyed(_: SceneNode, co: Colider): void {
        this.allColiders.delete(co as StaticAABBColider);
        this.reverse.delete(co);
        this.staticColiders.delete(co as StaticAABBColider);
        this.dynamicColiders.delete(co as DynamicAABBColider);
    }

    public update(): void {
        const dt = Game.deltaTime;

        // Accel/Velocity/Position
        const accel = [0, 0, 0];
        for (const dc of this.dynamicColiders) {
            // Apply gravity
            vec3.add(dc.forces, GRAVITY, dc.forces);
            // Calculate acceleration
            vec3.scale(dc.forces, dc.inverseMass, accel);
            // update velocity (does velocity get cleared each frame or does it persist)
            vec3.addScaled(dc.velocity, accel, dt, dc.velocity);

            // drag?
            if (dc.drag > 0) {
                const dragFactor = 1 - dc.drag * dt;
                vec3.scale(dc.velocity, Math.max(dragFactor, 0), dc.velocity); // Apply drag
            }

            //position update
            dc.moveBy(
                dc.velocity[0] * dt,
                dc.velocity[1] * dt,
                dc.velocity[2] * dt
            );
            // reset force AX
            vec3.zero(dc.forces);

            dc.collisions.clear();
            dc.onFloor = false;
        }

        const collision: [DynamicAABBColider, AABB][] = [];

        // this shit is fucking terrible
        for (const dc of this.dynamicColiders) {
            for (const ot of this.dynamicColiders) {
                if (ot == dc) continue;
                if (!aabbToAabb(dc, ot)) continue;

                if (ot.detectLayers & dc.onLayers) {
                    ot.collisions.set(dc, {
                        colider: dc,
                        node: this.reverse.get(dc)!,
                    });
                }

                if (dc.detectLayers & ot.onLayers) {
                    dc.collisions.set(ot, {
                        colider: ot,
                        node: this.reverse.get(ot)!,
                    });
                }
                collision.push([dc, ot]);
            }

            for (const other of this.staticColiders) {
                if (!aabbToAabb(dc, other)) continue;

                if (other.detectLayers & dc.onLayers) {
                    other.collisions.set(dc, {
                        colider: dc,
                        node: this.reverse.get(dc)!,
                    });
                }
                if (dc.detectLayers & other.onLayers) {
                    dc.collisions.set(other, {
                        colider: other,
                        node: this.reverse.get(other)!,
                    });
                }
                collision.push([dc, other]);
            }
        }

        // apply all collisions
        for (const [dyn, otr] of collision) {
            if (otr.onLayers & LAYER_PHYSICS) {
                const mv = aaabResolve(dyn, otr);
                if (mv[1] > 0) dyn.onFloor = true;

                dyn.moveBy(...mv);
                // mv is vector that stops us from coliding
                // update dyn.velocity to stop it in the collision direction

                // Normalize the collision vector to get the normal
                const mvLength = Math.sqrt(
                    mv[0] * mv[0] + mv[1] * mv[1] + mv[2] * mv[2]
                );
                const normal = [
                    mv[0] / mvLength,
                    mv[1] / mvLength,
                    mv[2] / mvLength,
                ];

                // Project velocity onto the normal
                const vRelDotN =
                    dyn.velocity[0] * normal[0] +
                    dyn.velocity[1] * normal[1] +
                    dyn.velocity[2] * normal[2];

                // If moving into the static object, stop in that direction
                if (vRelDotN < 0) {
                    dyn.velocity[0] -= vRelDotN * normal[0];
                    dyn.velocity[1] -= vRelDotN * normal[1];
                    dyn.velocity[2] -= vRelDotN * normal[2];
                }
            }
        }

        // copy body.pos -> node.pos
        for (const dyn of this.dynamicColiders) {
            const t = this.reverse.get(dyn)?.transform;
            if (!t) continue;
            t.translation.set(dyn.position);
            t.update();
        }
    }

    public raycast(
        from: Vec3 | V3,
        dir: Vec3 | V3,
        layers: number,
        ignore?: AABB
    ): IRayHit[] {
        const invDir = [1 / dir[0], 1 / dir[1], 1 / dir[2]];

        const aabss = this.allColiders
            .values()
            .filter((x) => (x.onLayers & layers) > 0 && x != ignore);

        const hits = [] as IRayHit[];

        for (const aabb of aabss) {
            let minT = 0,
                maxT = Infinity;

            const axt = (aabb.min[0] - from[0]) * invDir[0];
            const bxt = (aabb.max[0] - from[0]) * invDir[0];
            minT = Math.max(minT, Math.min(axt, bxt));
            maxT = Math.max(axt, bxt);
            if (maxT < minT) continue;

            const ayt = (aabb.min[1] - from[1]) * invDir[1];
            const byt = (aabb.max[1] - from[1]) * invDir[1];
            minT = Math.max(minT, Math.min(ayt, byt));
            maxT = Math.min(maxT, Math.max(ayt, byt));
            if (maxT < minT) continue;

            const azt = (aabb.min[2] - from[2]) * invDir[2];
            const bzt = (aabb.max[2] - from[2]) * invDir[2];
            minT = Math.max(minT, Math.min(azt, bzt));
            maxT = Math.min(maxT, Math.max(azt, bzt));
            if (maxT < minT) continue;

            hits.push({
                colider: aabb,
                node: this.reverse.get(aabb)!,
                t: minT,
                rayEntry: vec3.addScaled(from, dir, minT),
                rayExit: vec3.addScaled(from, dir, maxT),
            });
        }

        return hits.sort((a, b) => a.t - b.t);
    }
}
