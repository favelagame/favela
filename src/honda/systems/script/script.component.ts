import { Script } from "./script";

export class ScriptComponent<T extends Script = Script> {
    public name: string;

    public constructor(public readonly script: T, name?: string) {
        this.name = name ?? script.constructor.name;
    }
}
