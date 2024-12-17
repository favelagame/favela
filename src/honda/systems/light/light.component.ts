import { Component } from "@/honda/ecs";
import { THondaLight } from "./lights.interface";

export class LightComponent extends Component {
    constructor(public lightInfo: THondaLight) {
        super();
        
        if (this.lightInfo.castShadows && this.lightInfo.type == 'point') {
            console.warn("pointlights don't support castShadows")
        }
    }
}
