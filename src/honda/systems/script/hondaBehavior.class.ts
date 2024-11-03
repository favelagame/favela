import { Entity } from "@/honda/core";
import { IHondaBehavior } from "./hondaBehavior.interface";

/* eslint-disable class-methods-use-this */
export abstract class HondaBehavior implements IHondaBehavior {
    protected entity: Entity = null!;

    onUpdate(): void {}
    beforeDestroy(): void {}
}
