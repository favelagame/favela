export interface IBase {
    extensions?: Record<string, unknown>;
    extras?: Record<string, unknown>;
}

export interface INamed extends IBase {
    name?: string;
}

//#region Accessor
export type TComponentType = 5120 | 5121 | 5122 | 5123 | 5125 | 5126;
export type TAccessorType =
    | "SCALAR"
    | "VEC2"
    | "VEC3"
    | "VEC4"
    | "MAT2"
    | "MAT3"
    | "MAT4"
    | "STRING";

export interface IAccessor {
    byteOffset?: number;
    bufferView?: number;
    normalized?: boolean;
    componentType: TComponentType;
    count: number;
    type: TAccessorType;
    sparse?: never; // TODO(never): Sparse accessors
}
//#endregion Accessor

export interface IAnimation extends INamed {
    channels: IAnimtionChannel[];
    samplers: IAnimationSampler[];
}

export interface IAnimtionChannel extends IBase {
    sampler: number;
    target: IAnimtionChannelTarget;
}

export interface IAnimtionChannelTarget extends IBase {
    node?: number;
    path: "translation" | "rotation" | "scale" | "weights" | string;
}

export interface IAnimationSampler extends IBase {
    input: number;
    output: number;
    interpolation: "LINEAR" | "STEP" | "CUBICSPLINE" | string;
}

export interface IAsset extends IBase {
    version: `${number}.${number}`;
    minVersion?: `${number}.${number}`;
    copyright?: string;
    generator?: string;
}

export interface IBuffer extends INamed {
    byteLength: number;
    uri?: string;
}

export interface IBufferView extends INamed {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
    target?: number;
}

export interface ICameraOrtographic extends IBase {
    xmag: number;
    ymag: number;
    zfar: number;
    znear: number;
}

export interface ICameraPerspective extends IBase {
    aspectRatio?: number;
    yfov: number;
    znear: number;
    zfar?: number;
}

export type TCamera = INamed &
    (
        | {
              type: "perspective";
              prespective: ICameraPerspective;
          }
        | {
              type: "ortographic";
              ortographic: ICameraOrtographic;
          }
        | {
              type: string;
          }
    );

//#region Image
export interface IBuferImage extends INamed {
    mimeType: string;
    bufferView: number;
}

export type TImage = IBuferImage; // potentially | IURIImage
//#endregion Image

//#region Material
export type TAlphaMode = "OPAQUE" | "MASK" | "BLEND";

export interface IMaterial extends INamed {
    pbrMetallicRoughness?: IMaterialPBRMetallicRoughness;
    normalTexture?: IMaterialNormalTextureInfo;
    occlusionTexture?: IMaterialOcclusionTextureInfo;
    emissiveTexture?: ITextureInfo;
    emissiveFactor?: [number, number, number];
    alphaMode?: TAlphaMode;
    alphaCutoff?: number;
    doubleSided?: boolean;
}
//#endregion Material

export interface IMaterialNormalTextureInfo extends ITextureInfo {
    scale?: number;
}

export interface IMaterialOcclusionTextureInfo extends ITextureInfo {
    strength?: number;
}

export interface IMaterialPBRMetallicRoughness extends IBase {
    baseColorFactor?: [number, number, number, number];
    baseColorTexture?: ITextureInfo;
    metallicFactor?: number;
    roughnessFactor?: number;
    metallicRoughnessTexture?: ITextureInfo;
}

export interface IMesh extends INamed {
    primitives: IMeshPrimitive[];
    weights?: number[];
}

//#region MeshPrimitive
export type TTopologyType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface IMeshPrimitive extends IBase {
    attributes: Record<string, number | undefined>;
    indices?: number;
    material?: number;
    mode?: TTopologyType;
    targets?: number[];
}
//#endregion MeshPrimitive

//#region Node
export interface INodeBase extends INamed {
    camera?: number;
    children?: number[];
    name?: string;
    mesh?: number;
    skin?: number;
    weights?: number[];

    extensions?: {
        KHR_lights_punctual?: {
            light: number;
        };
    };
}

export interface INodeWithMatrix extends INodeBase {
    matrix: Iterable<number>;
    translation?: never;
    rotation?: never;
    scale?: never;
}

export interface INodeWithTRS extends INodeBase {
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    matrix?: never;
}

export type TNode = INodeWithMatrix | INodeWithTRS;
//#endregion Node

//#region Sampler
export type TWrap = 33071 | 33648 | 10497;
export type TFilterBase = 9728 | 9729;
export type TFilterMag = TFilterBase;
export type TFilterMin = TFilterBase | 9984 | 9985 | 9986 | 9987;

export interface ISampler extends INamed {
    magFilter?: TFilterMag;
    minFilter?: TFilterMin;
    wrapS?: TWrap;
    wrapT?: TWrap;
}
//#endregion Sampler

export interface IScene extends INamed {
    nodes?: number[];
}

export interface ISkin extends INamed {
    inverseBindMatrices?: number;
    skeleton?: number;
    joints: number[];
}

export interface ITexture extends INamed {
    extensions?: {
        EXT_texture_webp?: {
            source: number;
        };
        [key: string]: unknown;
    };
    source?: number;
    sampler?: number;
}

export interface ITextureInfo extends IBase {
    index: number;
    texCoord?: number;
}

export type TKhrLightType = "spot" | "point" | "directional" | string;

export interface IKhrLightSpot extends IBase {
    innerConeAngle?: number;
    outerConeAngle?: number;
}

export interface IKhrLight extends INamed {
    type: TKhrLightType;
    color?: [number, number, number];
    intensity?: number;
    range?: number;
    spot?: IKhrLightSpot;
}

export interface IGltfRoot extends IBase {
    extensionsUsed?: string[];
    extensionsRequired?: string[];

    accessors?: IAccessor[];
    animations: IAnimation[];
    asset: IAsset;
    buffers?: IBuffer[];
    bufferViews?: IBufferView[];
    cameras?: TCamera[];
    images?: TImage[];
    materials?: IMaterial[];
    meshes?: IMesh[];
    nodes?: TNode[];
    samplers?: ISampler[];
    scene?: number;
    scenes?: IScene[];
    skins?: ISkin[];
    textures?: ITexture[];

    extensions?: {
        KHR_lights_punctual?: {
            lights: IKhrLight[];
        };
    };
}
