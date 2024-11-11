export type TTopologyType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface IMeshPrimitive {
    attributes: Record<string, number>;
    indices?: number;
    material?: number;
    mode?: TTopologyType;
}

export interface IMesh {
    name: string;
    primitives: IMeshPrimitive[];
}

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
    sparse?: never; // TODO: never
}

export interface IBufferView {
    buffer: number;
    byteLength: number;
    byteOffset?: number;
    target?: number;
}
export interface IBuffer {
    byteLength: number;
    uri?: string;
}

interface ITextureInfo {
    index: number;
    texCoord?: number;
}

export interface IPBRMaterial {
    baseColorFactor?: [number, number, number, number];
    baseColorTexture?: ITextureInfo;
    metallicFactor?: number;
    roughnessFactor?: number;
    metallicRoughnessTexture?: ITextureInfo;
}

interface IMaterialNormalTextureInfo extends ITextureInfo {
    scale?: number;
}

interface IMaterialOcclusionTextureInfo {
    strength?: number;
}

type TAlphaMode = "OPAQUE" | "MASK" | "BLEND";

interface IMaterial {
    name?: string;

    pbrMetallicRoughness?: IPBRMaterial;
    normalTexture?: IMaterialNormalTextureInfo;
    occlusionTexture?: IMaterialOcclusionTextureInfo;
    emissiveTexture?: ITextureInfo;
    emissiveFactor?: [number, number, number];

    alphaMode?: TAlphaMode;
    alphaCutoff?: number;
    doubleSided?: boolean;
}

export interface IImage {
    mimeType: string;
    bufferView: number;
    name?: string;
}

export type TWrap = 33071 | 33648 | 10497;
export type TFilterBase = 9728 | 9729;
export type TFilterMag = TFilterBase;
export type TFilterMin = TFilterBase | 9984 | 9985 | 9986 | 9987;

interface ISampler {
    magFilter?: TFilterMag;
    minFilter?: TFilterMin;
    wrapS?: TWrap;
    wrapT?: TWrap;
    name?: string;
}

interface ITexture {
    extensions: {
        EXT_texture_webp: {
            source: number;
        };
    };

    sampler: number;
}

interface INodeBase {
    camera?: number; // Reference to the camera index
    children?: number[]; // Array of child node indices, must be unique
    name?: string; // Optional name property
    mesh?: number; // Reference to the mesh index
    weights?: number[]; // Weights for morph targets, requires 'mesh' if present
    skin?: number; // Reference to the skin index, requires 'mesh' if present
}

interface INodeWithMatrix extends INodeBase {
    matrix: Iterable<number>; // 4x4 column-major matrix
    translation?: never;
    rotation?: never;
    scale?: never;
}

interface INodeWithTRS extends INodeBase {
    translation?: [number, number, number]; // Translation along x, y, z, default: [0.0, 0.0, 0.0]
    rotation?: [number, number, number, number]; // Quaternion (x, y, z, w), default: [0.0, 0.0, 0.0, 1.0]
    scale?: [number, number, number]; // Non-uniform scale factors, default: [1.0, 1.0, 1.0]
    matrix?: never;
}

type TNode = INodeWithMatrix | INodeWithTRS;

export interface IRoot {
    meshes: IMesh[];
    accessors: IAccessor[];
    bufferViews: IBufferView[];
    buffers: IBuffer[];
    materials: IMaterial[];
    images: IImage[];
    textures: ITexture[];
    samplers: ISampler[];
    nodes: TNode[];

    extensionsUsed?: string[];
    extensionsRequired?: string[];
}
