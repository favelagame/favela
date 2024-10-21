import { System, Entity, ComponentClass, ECS } from "@/honda/ecs";
import { ScriptComponent } from "./script.component";
import { HondaBehavior } from "./hondaBehavior.class";


export class ScriptSystem extends System {
    public componentsRequired = new Set([ScriptComponent]);

    public update(entities: Set<Entity>): void {
        entities.forEach((eid) => {
            const sc = this.ecs
                .getComponents(eid)
                .get(ScriptComponent) as ScriptComponent<HondaBehavior>;

            if (!sc.instance) {
                const ctor = sc.script;
                const deps = Reflect.getMetadata(
                    "design:paramtypes",
                    ctor
                ) as unknown[];

                console.assert(deps[0] === Number, 'EID wasnt first');
                const components = this.ecs.getComponents(eid);

                const args = (deps as ComponentClass<never>[]).slice(1).map((x) => x == ECS ? (this.ecs as never) : components.get(x)
                );
                sc.instance = new sc.script(eid, ...args);
            }
            sc.instance.onUpdate();
        });
    }
}
