import { Component, ECS, Entity, System } from "../ecs";

export class CScript extends Component {
    constructor(public update: (eid: Entity, ecs: ECS) => void) {
        super();
    }
}

export class ScriptSystem extends System {
    public componentsRequired = new Set([CScript]);

    public update(entities: Set<Entity>): void {
        entities.forEach((eid) => {
            this.ecs.getComponents(eid).get(CScript).update(eid, this.ecs);
        });
    }
}
