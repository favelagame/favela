import { Component, EcsInjectable } from "@/honda/core";
import { HondaBehavior } from "./hondaBehavior.class";

type ScriptCtor<T = unknown> = new (eid: number, ...otherArgs: never[]) => T;

@EcsInjectable()
export class ScriptComponent<
    T extends HondaBehavior = HondaBehavior
> extends Component {
    public instance: T | undefined;
    constructor(public script: ScriptCtor<T>) {
        super();
    }
}


