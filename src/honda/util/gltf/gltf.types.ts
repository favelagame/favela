export interface IMeshPrimitive {
    indices: number;
    attributes: Record<string, number>;
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

export interface IRoot {
    meshes: IMesh[];
    accessors: IAccessor[];
    bufferViews: IBufferView[];
    buffers: IBuffer[];
}
