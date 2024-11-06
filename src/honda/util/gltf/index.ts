const GLB_MAGIC = 0x46546c67;
const GLB_CHUNKYTPE_JSON = 0x4e4f534a;
const GLB_CHUNKTYPE_BIN = 0x004e4942;

import type * as TG from "./gltf.types";

export type TTypedArrayCtor<T> = {
    new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): T;
    BYTES_PER_ELEMENT: number;
};
export type TypedArrays =
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Uint32Array
    | Float32Array;

export interface FavelaAccesor<
    Tbuffer extends TypedArrays = TypedArrays,
    Taccessor extends TG.TAccessorType = TG.TAccessorType
> {
    accessor: Tbuffer;
    isElement: boolean;
    normalized: false | undefined;
    type: Taccessor;
    count: number;
}

export interface FavelaBufferView {
    buffer: ArrayBuffer;
    isElement: boolean;
    bOffset: number;
    bLength: number;
}

export interface MeshDataV1 {
    name: string;
    indexBuffer: FavelaAccesor<Uint16Array, "SCALAR">;
    posBuffer: FavelaAccesor<Float32Array, "VEC3">;
    normBuffer: FavelaAccesor<Float32Array, "VEC3">;
    uvBuffer: FavelaAccesor<Float32Array, "VEC2">;
}

export class Gltf {
    static readonly COMP_TYPE_TO_CTOR: Record<
        TG.TComponentType,
        TTypedArrayCtor<TypedArrays>
    > = {
        5120: Int8Array,
        5121: Uint8Array,
        5122: Int16Array,
        5123: Uint16Array,
        5125: Uint32Array,
        5126: Float32Array,
    };

    public json: TG.IRoot;
    protected bin: ArrayBufferView;

    constructor(buf: ArrayBuffer) {
        const bufU32 = new Uint32Array(buf);

        const [magic, version] = bufU32;

        if (magic != GLB_MAGIC) {
            throw new Error("Invalid magic, this isn't glTF");
        }

        if (version != 2) {
            throw new Error("Only version 2 is supported");
        }

        let jsonView, binView: ArrayBufferView | undefined;

        for (let i = 3; i < bufU32.length; ) {
            const cLen = bufU32[i];
            const cType = bufU32[i + 1];

            const dv = new DataView(buf, (i + 2) * 4, cLen);

            if (cType == GLB_CHUNKYTPE_JSON) jsonView = dv;
            else if (cType == GLB_CHUNKTYPE_BIN) binView = dv;

            i += Math.ceil(cLen / 4) + 2;
        }

        if (!(jsonView && binView)) throw new Error("Missing chunk(s)");
        this.json = JSON.parse(new TextDecoder().decode(jsonView));
        this.bin = binView;
    }

    public static async fromUrl(url: string) {
        const f = await fetch(url);
        const buf = await f.arrayBuffer();

        return new Gltf(buf);
    }

    public getBuffer(index: number) {
        const gBuffer = this.json.buffers[index];
        if (index != 0 || !gBuffer) {
            throw new Error("Jeba");
        }
        if (gBuffer.byteLength != this.bin.byteLength) {
            throw new Error("What the sigma");
        }
        return this.bin.buffer;
    }

    public getBufferView(index: number): FavelaBufferView {
        const gBufferView = this.json.bufferViews[index];
        if (!gBufferView) {
            throw new Error("Jeba");
        }

        return {
            buffer: this.getBuffer(gBufferView.buffer),
            isElement: !!(gBufferView.target ?? 0 & 1),
            bOffset: gBufferView.byteOffset ?? 0,
            bLength: gBufferView.byteLength,
        };
    }

    public getAccessor(index: number): FavelaAccesor {
        const gAccessor = this.json.accessors[index];
        if (!gAccessor) throw new Error("Accessor index out of bounds");

        if (
            gAccessor.normalized ||
            gAccessor.sparse ||
            typeof gAccessor.bufferView != "number"
        ) {
            throw new Error("Unsupported");
        }

        const arrCtor = Gltf.COMP_TYPE_TO_CTOR[gAccessor.componentType];
        const bv = this.getBufferView(gAccessor.bufferView);

        const accessor = new arrCtor(
            bv.buffer,
            bv.bOffset + this.bin.byteOffset, //FIXME: this can fuck up if there are multiple buffers
            Math.floor(bv.bLength / arrCtor.BYTES_PER_ELEMENT) //TODO: is this OK?
        );

        return {
            accessor,
            isElement: bv.isElement,
            normalized: gAccessor.normalized ?? false,
            type: gAccessor.type,
            count: gAccessor.count,
        };
    }

    public getAccessorAndAssertType<
        Taccessor extends TG.TAccessorType,
        Tbuffer extends TypedArrays
    >(
        index: number,
        expectedType: Taccessor,
        expectedBufferType: TTypedArrayCtor<Tbuffer>
    ): FavelaAccesor<Tbuffer, Taccessor> {
        const accessor = this.getAccessor(index);
        if (accessor.type != expectedType) {
            throw new Error(
                `Accessor's type (${accessor.type}}) != expected type (${expectedType})`
            );
        }

        if (!(accessor.accessor instanceof expectedBufferType)) {
            throw new Error(
                `Underlaying buffer doesn't match expected TypedArray`
            );
        }

        return accessor as unknown as FavelaAccesor<Tbuffer, Taccessor>;
    }

    public getMeshDataV1(index: number): MeshDataV1 {
        const gMesh = this.json.meshes[index];
        if (!gMesh) throw new Error("Mesh index out of bounds");
        if (gMesh.primitives.length > 1) {
            throw new Error("Unsupported: multiple primitives in mesh");
        }

        const [gPrimitive] = gMesh.primitives;

        if (
            !("POSITION" in gPrimitive.attributes) ||
            !("NORMAL" in gPrimitive.attributes) ||
            !("TEXCOORD_0" in gPrimitive.attributes)
        ) {
            throw new Error("Unsupported: missing attributes");
        }

        const indexBuffer = this.getAccessorAndAssertType(
                gPrimitive.indices,
                "SCALAR",
                Uint16Array
            ),
            posBuffer = this.getAccessorAndAssertType(
                gPrimitive.attributes["POSITION"],
                "VEC3",
                Float32Array
            ),
            normBuffer = this.getAccessorAndAssertType(
                gPrimitive.attributes["NORMAL"],
                "VEC3",
                Float32Array
            ),
            uvBuffer = this.getAccessorAndAssertType(
                gPrimitive.attributes["TEXCOORD_0"],
                "VEC2",
                Float32Array
            );

        return {
            name: gMesh.name,
            indexBuffer,
            posBuffer,
            normBuffer,
            uvBuffer,
        };
    }
}
