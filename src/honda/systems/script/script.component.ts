import { Component, EcsInjectable } from "@/honda/ecs";
import { HondaBehavior } from "./hondaBehavior.class";

type ScriptCtor<T = unknown> = new (id: number, ...otherArgs: never[]) => T;

@EcsInjectable()
export class ScriptComponent<
    T extends HondaBehavior = HondaBehavior
> extends Component {
    public instance: T | undefined;
    constructor(public script: ScriptCtor<T>) {
        super();
    }
}


