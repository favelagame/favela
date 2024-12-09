interface IBaseLight {
    color: [number, number, number];
    intersity: number;
    maxRange: number;
}

export interface IPointLight extends IBaseLight {
    type: "point";
}

export interface IDirectionalLight extends IBaseLight {
    type: "directional";
}

export interface ISpotLight {
    type: "spot";
    innerCone: number;
    outerCone: number;
}

export type THondaLight = IPointLight | IDirectionalLight | ISpotLight;
