import { ECS, Entity } from "@/honda/ecs";
import { IHondaBehavior } from "./hondaBehavior.interface";

/* eslint-disable class-methods-use-this */
export abstract class HondaBehavior implements IHondaBehavior {
    protected ecs: ECS = null!;
    protected entity: Entity = null!;

    onUpdate(): void {}
    beforeDestroy(): void {}
}
