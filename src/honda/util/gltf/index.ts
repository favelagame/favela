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

export interface TexturedMeshDataV1 {
    name: string;
    indexBuffer: FavelaAccesor<Uint16Array, "SCALAR">;
    posBuffer: FavelaAccesor<Float32Array, "VEC3">;
    normBuffer: FavelaAccesor<Float32Array, "VEC3">;
    uvBuffer: FavelaAccesor<Float32Array, "VEC2">;
    baseTex: TextureV1;
}

export interface TextureV1 {
    samplerDescriptor: GPUSamplerDescriptor;
    image: ImageBitmap;
}

export class Gltf {
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
                console.warn(
                    "Unsupported sampler filter mode:",
                    n,
                    "defaulting to linear"
                );
                return "linear";
        }
    }

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

        this.checkExt();
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
            console.warn(
                `Unsupported: multiple primitives in mesh (index: ${index}, name: ${
                    gMesh.name || "<none>"
                })`
            );
        }

        const [gPrimitive] = gMesh.primitives;

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
            name: gMesh.name,
            indexBuffer,
            posBuffer,
            normBuffer,
            uvBuffer,
        };
    }

    public getTexturedMeshV1(index: number): TexturedMeshDataV1 {
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
            name: gMesh.name,
            indexBuffer,
            posBuffer,
            normBuffer,
            uvBuffer,
            baseTex,
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
        const gImage = this.imageCache[imageIdx];
        if (!gImage) {
            throw new Error(
                "Image index OOB, did you forget to call prepareImages()?"
            );
        }
        return gImage;
    }

    protected imageCache: ImageBitmap[] = [];

    /*
     we avoid making all methods async,
     by requiring a single async call to put images in cache
     */
    public async prepareImages() {
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

    public generateNodeDot(): string {
        const nodes = this.json.nodes;
        if (!nodes) {
            throw new Error("No nodes found in the glTF file");
        }

        let dot = "digraph G {\n";

        nodes.forEach((node, index) => {
            dot += `  node${index} [label="${node.name || `node${index}`}"];\n`;
            if (node.children) {
                node.children.forEach((childIndex) => {
                    dot += `  node${index} -> node${childIndex};\n`;
                });
            }
        });

        dot += "}\n";
        return dot;
    }
}
