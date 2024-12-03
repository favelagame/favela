import { nn } from "..";
import { getNewResourceId } from "../resource";
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
    id: number;
    name: string;
    indexBuffer: FavelaAccesor<Uint16Array, "SCALAR">;
    posBuffer: FavelaAccesor<Float32Array, "VEC3">;
    normBuffer: FavelaAccesor<Float32Array, "VEC3">;
    uvBuffer: FavelaAccesor<Float32Array, "VEC2">;
}

export interface TexturedMeshDataV1 extends MeshDataV1 {
    baseTex: TextureV1;
}

export interface TexturedMeshDataV2 extends TexturedMeshDataV1 {
    normalTex?: TextureV1;
}

export interface TextureV1 {
    samplerDescriptor: GPUSamplerDescriptor;
    image: ImageBitmap;
}

// TODO(mbabnik) texture,material cache, (maybe also move mesh cache inside here)

export class Gltf {
    private static readonly MAGIC = 0x46546c67;
    private static readonly CHUNKYTPE_JSON = 0x4e4f534a;
    private static readonly CHUNKTYPE_BIN = 0x004e4942;

    public static readonly supportedExtensions: string[] = ["EXT_texture_webp"];

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

    static readonly SAMPLER_TO_WGPU: Record<TG.TWrap, GPUAddressMode> = {
        33071: "clamp-to-edge",
        33648: "mirror-repeat",
        10497: "repeat",
    };

    static getWebGpuSamplerFilter(
        n: TG.TFilterMag | TG.TFilterMin
    ): GPUFilterMode {
        switch (n) {
            case 9728:
                return "nearest";
            case 9729:
                return "linear";
            default:
                // this just spams the console
                // console.warn(
                //     "Unsupported sampler filter mode:",
                //     n,
                //     "defaulting to linear"
                // );
                return "linear";
        }
    }

    public static async fromUrl(url: string) {
        const f = await fetch(url);
        const buf = await f.arrayBuffer();

        return new Gltf(buf, url);
    }

    public json: TG.IRoot;
    private bin: ArrayBufferView;
    private imageCache: ImageBitmap[] = [];

    constructor(buf: ArrayBuffer, protected name = "<unknown glTF>") {
        const bufU32 = new Uint32Array(buf);

        const [magic, version] = bufU32;

        if (magic != Gltf.MAGIC) {
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

            if (cType == Gltf.CHUNKYTPE_JSON) jsonView = dv;
            else if (cType == Gltf.CHUNKTYPE_BIN) binView = dv;

            i += Math.ceil(cLen / 4) + 2;
        }

        this.json = JSON.parse(
            new TextDecoder().decode(nn(jsonView, "Missing JSON chunk"))
        );
        this.bin = nn(binView, "Missing Binary chunk");

        this.checkExt();
    }

    /**
     Call this if you need to load textures.
     */
    public async prepareImages(): Promise<void> {
        this.imageCache = await Promise.all(
            this.json.images.map((imgDef) => {
                const ibv = this.getBufferView(imgDef.bufferView);

                const base = ibv.bOffset + this.bin.byteOffset;
                const blob = new Blob(
                    [ibv.buffer.slice(base, base + ibv.bLength)],
                    { type: imgDef.mimeType }
                );

                return createImageBitmap(blob);
            })
        );
    }

    protected checkExt() {
        const unsupportedRequired =
            this.json?.extensionsRequired?.filter(
                (ext) => !Gltf.supportedExtensions.includes(ext)
            ) ?? [];
        const unsupportedUsed =
            this.json?.extensionsRequired?.filter(
                (ext) => !Gltf.supportedExtensions.includes(ext)
            ) ?? [];

        if (unsupportedRequired.length > 0) {
            console.error(
                "Unsupported extensions required:",
                unsupportedRequired.join(", ")
            );
        }
        if (unsupportedUsed.length > 0) {
            console.warn(
                "Unsupported extensions used:",
                unsupportedUsed.join(", ")
            );
        }
    }

    public getBuffer(index: number) {
        if (index !== 0) {
            throw new Error(
                `Multiple buffers not supported (requested buffer ${index})!`
            );
        }

        const gBuffer = nn(this.json.buffers[index]);

        if (gBuffer.byteLength != this.bin.byteLength) {
            console.warn(
                `Buffer size mismatch (JSON: ${gBuffer.byteLength} BIN: ${this.bin.byteLength}) `
            );
        }
        return this.bin.buffer;
    }

    public getBufferView(index: number): FavelaBufferView {
        const gBufferView = nn(this.json.bufferViews[index], "bufferView OOB");

        return {
            buffer: this.getBuffer(gBufferView.buffer),
            isElement: !!(gBufferView.target ?? 0 & 1),
            bOffset: gBufferView.byteOffset ?? 0,
            bLength: gBufferView.byteLength,
        };
    }

    public getAccessor(index: number): FavelaAccesor {
        const gAccessor = nn(this.json.accessors[index], "accessor OOB");
        if (
            gAccessor.normalized ||
            gAccessor.sparse ||
            typeof gAccessor.bufferView != "number"
        ) {
            throw new Error("Unsupported");
        }

        const TypedArrayCtor = Gltf.COMP_TYPE_TO_CTOR[gAccessor.componentType];
        const bv = this.getBufferView(gAccessor.bufferView);

        const accessor = new TypedArrayCtor(
            bv.buffer,
            bv.bOffset + this.bin.byteOffset, //FIXME: this can fuck up if there are multiple buffers
            Math.floor(bv.bLength / TypedArrayCtor.BYTES_PER_ELEMENT) //TODO: is this OK?
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

    protected getMeshPrimitive(index: number) {
        const gMesh = nn(this.json.meshes[index], "mesh OOB");

        if (gMesh.primitives.length > 1) {
            console.warn(
                `Unsupported: multiple primitives in mesh (index: ${index}, name: ${
                    gMesh.name || "<none>"
                })`
            );
        }

        return nn(gMesh.primitives[0], `Mesh ${index} has no primitives`);
    }

    public getMeshDataV1(index: number): MeshDataV1 {
        const name = this.json.meshes[index]?.name ?? "<unknown>";
        const gPrimitive = this.getMeshPrimitive(index);

        if (
            !("POSITION" in gPrimitive.attributes) ||
            !("NORMAL" in gPrimitive.attributes) ||
            !("TEXCOORD_0" in gPrimitive.attributes)
        ) {
            throw new Error("Unsupported: missing attributes");
        }

        const indices = gPrimitive.indices;
        if (indices === undefined) {
            throw new Error("Unsupported: non-indexed geometry");
        }

        if (gPrimitive.mode !== undefined && gPrimitive.mode != 4) {
            throw new Error("Unsupported: non-triagle-list geometry");
        }

        const indexBuffer = this.getAccessorAndAssertType(
                indices,
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
            id: getNewResourceId(),
            name,
            indexBuffer,
            posBuffer,
            normBuffer,
            uvBuffer,
        };
    }

    public getTexturedMeshV1(index: number): TexturedMeshDataV1 {
        const name = this.json.meshes[index]?.name ?? "<unknown>";
        const gPrimitive = this.getMeshPrimitive(index);

        if (
            !("POSITION" in gPrimitive.attributes) ||
            !("NORMAL" in gPrimitive.attributes) ||
            !("TEXCOORD_0" in gPrimitive.attributes)
        ) {
            throw new Error("Unsupported: missing attributes");
        }

        const indices = gPrimitive.indices;
        if (indices === undefined) {
            throw new Error("Unsupported: non-indexed geometry");
        }

        if (gPrimitive.mode !== undefined && gPrimitive.mode != 4) {
            throw new Error("Unsupported: non-triagle-list geometry");
        }

        const indexBuffer = this.getAccessorAndAssertType(
                indices,
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

        const materialIdx = gPrimitive.material;
        if (materialIdx === undefined) {
            throw new Error("Mesh does not have a material/texture");
        }
        const baseTex = this.getBaseColorTextureFromMaterial(materialIdx);

        return {
            id: getNewResourceId(),
            name,
            indexBuffer,
            posBuffer,
            normBuffer,
            uvBuffer,
            baseTex,
        };
    }

    public getTexturedMeshV2(index: number): TexturedMeshDataV2 {
        const name = this.json.meshes[index]?.name ?? "<unknown>";
        const gPrimitive = this.getMeshPrimitive(index);

        if (
            !("POSITION" in gPrimitive.attributes) ||
            !("NORMAL" in gPrimitive.attributes) ||
            !("TEXCOORD_0" in gPrimitive.attributes)
        ) {
            throw new Error("Unsupported: missing attributes");
        }

        const indices = gPrimitive.indices;
        if (indices === undefined) {
            throw new Error("Unsupported: non-indexed geometry");
        }

        if (gPrimitive.mode !== undefined && gPrimitive.mode != 4) {
            throw new Error("Unsupported: non-triagle-list geometry");
        }

        const indexBuffer = this.getAccessorAndAssertType(
                indices,
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

        const materialIdx = gPrimitive.material;
        if (materialIdx === undefined) {
            throw new Error("Mesh does not have a material/texture");
        }

        const baseTex = this.getBaseColorTextureFromMaterial(materialIdx);
        const normalTex = this.getNormalMapFromMaterial(materialIdx);
        return {
            id: getNewResourceId(),
            name,
            indexBuffer,
            posBuffer,
            normBuffer,
            uvBuffer,
            baseTex,
            normalTex,
        };
    }

    public getBaseColorTextureFromMaterial(materialIdx: number): TextureV1 {
        const gMaterial = this.json.materials[materialIdx];
        if (!gMaterial) throw new Error("Material index OOB");

        if (!gMaterial.pbrMetallicRoughness) {
            throw new Error("No pbrMetallicRoughness component");
        }

        if (gMaterial.pbrMetallicRoughness.baseColorTexture === undefined) {
            throw new Error("No base color texture");
        }

        const textureInfo = gMaterial.pbrMetallicRoughness.baseColorTexture!;

        if (textureInfo.texCoord !== 0 && textureInfo.texCoord !== undefined) {
            throw new Error("Unsupported: Multiple UVs");
        }

        return this.getTexture(textureInfo.index);
    }

    public getNormalMapFromMaterial(
        materialIdx: number
    ): TextureV1 | undefined {
        const gMaterial = this.json.materials[materialIdx];
        if (!gMaterial) throw new Error("Material index OOB");

        if (!gMaterial.normalTexture) {
            return undefined;
        }

        const textureInfo = gMaterial.normalTexture!;

        if (textureInfo.texCoord !== 0 && textureInfo.texCoord !== undefined) {
            throw new Error("Unsupported: Multiple UVs");
        }

        return this.getTexture(textureInfo.index);
    }

    public getTexture(texId: number) {
        const gTexture = this.json.textures[texId];
        if (!gTexture) throw new Error("Texture index OOB");

        if (gTexture?.extensions?.EXT_texture_webp?.source === undefined) {
            throw new Error("No supported textures found.");
        }

        return {
            samplerDescriptor: this.getWebgpuSamplerDescriptor(
                gTexture.sampler
            ),
            image: this.getImage(gTexture.extensions.EXT_texture_webp.source!),
        };
    }

    public getWebgpuSamplerDescriptor(
        samplerIdx: number
    ): GPUSamplerDescriptor {
        const gSampler = this.json.samplers[samplerIdx];
        if (!gSampler) {
            throw new Error("Sampler idx OOB");
        }

        return {
            addressModeU: Gltf.SAMPLER_TO_WGPU[gSampler.wrapS ?? 10497],
            addressModeV: Gltf.SAMPLER_TO_WGPU[gSampler.wrapT ?? 10497],
            minFilter: Gltf.getWebGpuSamplerFilter(gSampler.minFilter ?? 9728),
            magFilter: Gltf.getWebGpuSamplerFilter(gSampler.magFilter ?? 9728),
        };
    }

    public getImage(imageIdx: number) {
        return nn(
            this.imageCache[imageIdx],
            "image OOB,  did you forget to call prepareImages()"
        );
    }
}
