import { SceneNode, System } from "@/honda";
import { ScriptComponent } from "./script.component";

interface PrivateScript {
    _node?: SceneNode;
}

export class ScriptSystem extends System {
    public componentType = ScriptComponent;

    protected components = new Map<ScriptComponent, SceneNode>();

    public componentCreated(node: SceneNode, comp: ScriptComponent) {
        if (this.components.has(comp)) {
            this.componentDestroyed(node, comp);
            console.warn("moved component to new node", comp, node);
        }
        (comp.script as unknown as PrivateScript)._node = node;
        this.components.set(comp, node);
    }

    public componentDestroyed(_: SceneNode, comp: ScriptComponent) {
        this.components.delete(comp);
        comp.script.onDetach();
        (comp.script as unknown as PrivateScript)._node = undefined;
    }

    public earlyUpdate(): void {
        this.components.keys().forEach((x) => x.script.earlyUpdate());
    }

    public update(): void {
        this.components.keys().forEach((x) => x.script.update());
    }

    public lateUpdate(): void {
        this.components.keys().forEach((x) => x.script.lateUpdate());
    }
}
