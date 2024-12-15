interface IBaseLight {
    color: [number, number, number];
    intensity: number;
}

export interface IPointLight extends IBaseLight {
    type: "point";
    maxRange: number;
}

export interface IDirectionalLight extends IBaseLight {
    type: "directional";
}

export interface ISpotLight extends IBaseLight {
    type: "spot";
    maxRange: number;
    innerCone: number;
    outerCone: number;
}

export type THondaLight = IPointLight | IDirectionalLight | ISpotLight;
