import { Mesh } from "@/honda/gpu/meshes/mesh";
import { nMips, nn } from "..";
import type * as TG from "./gltf.types";
import { Material } from "@/honda/gpu/material/material";
import { Game } from "@/honda/state";
import { generateMipmap } from "webgpu-utils";
import { quat, vec3, vec4 } from "wgpu-matrix";
import { AlphaMode } from "@/honda/gpu/material/material.types";
import {
    IDirectionalLight,
    IPointLight,
    ISpotLight,
    THondaLight,
} from "@/honda/systems/light";
import { SceneNode } from "@/honda/core/node";
import { MeshComponent } from "@/honda/systems/mesh";
import { LightComponent } from "@/honda/systems/light";
import {
    LAYER_ENEMY,
    LAYER_INTERACT,
    LAYER_PHYSICS,
    LAYER_PICKUP,
    LAYER_QUERY,
    StaticAABBColider,
} from "@/honda/systems/physics/colider.component";

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

export interface POI {
    position: [number, number, number];
    name: string;
    props: Record<string, unknown>;
}

/**
 * # glTF Binary (glb) parser, loader, utility class and more...
 */
export class GltfBinary {
    private static readonly MAGIC = 0x46546c67;
    private static readonly CHUNKYTPE_JSON = 0x4e4f534a;
    private static readonly CHUNKTYPE_BIN = 0x004e4942;

    public static readonly supportedExtensions: string[] = [
        "EXT_texture_webp",
        "EXT_texture_avif", // i think?
        "KHR_lights_punctual",
    ];

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

    static readonly ALPHA_MODE_MAP: Record<TG.TAlphaMode, AlphaMode> = {
        BLEND: AlphaMode.BLEND,
        MASK: AlphaMode.MASK,
        OPAQUE: AlphaMode.OPAQUE,
    };

    static readonly COLIDER_LAYER_MAP: Record<string, number> = {
        physics: LAYER_PHYSICS,
        enemy: LAYER_ENEMY,
        interact: LAYER_INTERACT,
        pickup: LAYER_PICKUP,
        query: LAYER_QUERY,
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
        const start = performance.now();
        console.time(url);
        const f = await fetch(url);
        const buf = await f.arrayBuffer();

        const gltf = new GltfBinary(buf, url);
        await gltf.prepareImages();
        console.log(`[GltfBinary] Loaded ${url} in ${(
            performance.now() - start
        ).toFixed(1)}ms
                Version: ${gltf.json.asset.version}
                Generator: ${gltf.json.asset.generator ?? "unknown"}
                Copyright: ${gltf.json.asset.copyright ?? "unknown"}
                Extensions: ${gltf.json.extensionsUsed?.join(",") ?? ""}
                `);
        return gltf;
    }

    public json: TG.IGltfRoot;

    protected gpuBufferCache = new Map<number, WeakRef<GPUBuffer>>();
    protected meshCache = new Map<number, WeakRef<Mesh>>();
    protected textureCache = new Map<number, WeakRef<GPUTexture>>();
    protected materialCache = new Map<number, WeakRef<Material>>();

    protected static cacheOr<T extends WeakKey>(
        cache: Map<number, WeakRef<T>>,
        key: number,
        fn: () => T
    ): T {
        const value = cache.get(key)?.deref();

        if (!value) {
            const v = fn();
            const nWeak = new WeakRef(v);
            cache.set(key, nWeak);
            return v;
        }

        return value;
    }

    private bin: ArrayBufferView;
    private imageCache: ImageBitmap[] = [];

    protected constructor(buf: ArrayBuffer, protected name = "<unknown glTF>") {
        const bufU32 = new Uint32Array(buf);

        const [magic, version] = bufU32;

        if (magic != GltfBinary.MAGIC) {
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

            if (cType == GltfBinary.CHUNKYTPE_JSON) jsonView = dv;
            else if (cType == GltfBinary.CHUNKTYPE_BIN) binView = dv;

            i += Math.ceil(cLen / 4) + 2;
        }

        this.json = JSON.parse(
            new TextDecoder().decode(nn(jsonView, "Missing JSON chunk"))
        );
        this.bin = nn(binView, "Missing Binary chunk");

        this.checkExt();
    }

    protected async prepareImages(): Promise<void> {
        this.imageCache = await Promise.all(
            (this.json.images ?? []).map((imgDef) => {
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
                (ext) => !GltfBinary.supportedExtensions.includes(ext)
            ) ?? [];
        const unsupportedUsed =
            this.json?.extensionsRequired?.filter(
                (ext) => !GltfBinary.supportedExtensions.includes(ext)
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

    protected getBuffer(index: number) {
        if (index !== 0) {
            throw new Error(
                `Multiple buffers not supported (requested buffer ${index})!`
            );
        }

        const gBuffer = nn(this.json.buffers?.[index]);

        if (gBuffer.byteLength != this.bin.byteLength) {
            console.warn(
                `Buffer size mismatch (JSON: ${gBuffer.byteLength} BIN: ${this.bin.byteLength}) `
            );
        }
        return this.bin.buffer as ArrayBuffer;
    }

    protected getBufferView(index: number): FavelaBufferView {
        const gBufferView = nn(
            this.json.bufferViews?.[index],
            "bufferView OOB"
        );

        return {
            buffer: this.getBuffer(gBufferView.buffer),
            isElement: !!(gBufferView.target ?? 0 & 1),
            bOffset: gBufferView.byteOffset ?? 0,
            bLength: gBufferView.byteLength,
        };
    }

    protected getAccessor(index: number): FavelaAccesor {
        const gAccessor = nn(this.json.accessors?.[index], "accessor OOB");
        if (
            gAccessor.normalized ||
            gAccessor.sparse ||
            typeof gAccessor.bufferView != "number"
        ) {
            throw new Error("Unsupported");
        }

        const TypedArrayCtor =
            GltfBinary.COMP_TYPE_TO_CTOR[gAccessor.componentType];
        const bv = this.getBufferView(gAccessor.bufferView);

        const accessor = new TypedArrayCtor(
            bv.buffer,
            bv.bOffset + this.bin.byteOffset,
            Math.floor(bv.bLength / TypedArrayCtor.BYTES_PER_ELEMENT)
        );

        return {
            accessor,
            isElement: bv.isElement,
            normalized: gAccessor.normalized ?? false,
            type: gAccessor.type,
            count: gAccessor.count,
        };
    }

    protected getAccessorAndAssertType<
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

    protected uploadAccesorToGpuWithAssertType<
        Taccessor extends TG.TAccessorType,
        Tbuffer extends TypedArrays
    >(
        index: number,
        expectedType: Taccessor,
        expectedBufferType: TTypedArrayCtor<Tbuffer>,
        usage: GPUBufferUsageFlags,
        label?: string
    ) {
        const accessor = this.getAccessorAndAssertType(
            index,
            expectedType,
            expectedBufferType
        );

        const b = Game.gpu.device.createBuffer({
            label,
            size: (accessor.accessor.byteLength + 3) & ~3, // make size a multiple of 4
            usage: usage | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });

        //@ts-expect-error "God, I wish there was an easier way to do this"
        const dst = new accessor.accessor.constructor(
            b.getMappedRange()
        ) as TypedArrays;
        dst.set(accessor.accessor);
        b.unmap();

        return b;
    }

    /**
     * @deprecated
     */
    protected getMeshPrimitive(index: number) {
        const gMesh = nn(this.json.meshes?.[index], "mesh OOB");

        if (gMesh.primitives.length > 1) {
            console.warn(
                `Unsupported: multiple primitives in mesh (index: ${index}, name: ${
                    gMesh.name || "<none>"
                })`
            );
        }

        return nn(gMesh.primitives[0], `Mesh ${index} has no primitives`);
    }

    protected getTextureImage(texId: number) {
        const gTexture = this.json.textures?.[texId];
        if (!gTexture) throw new Error("Texture index OOB");

        const source =
            gTexture?.extensions?.EXT_texture_webp?.source ??
            //@ts-expect-error asdsad
            gTexture?.extensions?.EXT_texture_avif?.source ??
            gTexture.source;

        if (source === undefined) {
            throw new Error("No supported textures found.");
        }

        return this.getImage(source!);
    }

    protected getTextureSamplerDescriptor(texId: number): GPUSamplerDescriptor {
        const gTexture = nn(this.json.textures?.[texId], "Texture index OOB");

        return this.getWebgpuSamplerDescriptor(
            nn(gTexture.sampler, "NO SAMPLER! Missing default?")
        );
    }

    protected getTextureData(texId: number) {
        const gTexture = nn(this.json.textures?.[texId], "Texture index OOB");
        if (!gTexture) throw new Error("Texture index OOB");

        const source =
            gTexture?.extensions?.EXT_texture_webp?.source ??
            //@ts-expect-error fuck
            gTexture?.extensions?.EXT_texture_avif?.source ??
            gTexture.source;

        if (source === undefined) {
            throw new Error("No supported textures found.");
        }

        return {
            samplerDescriptor: this.getWebgpuSamplerDescriptor(
                nn(gTexture.sampler, "NO SAMPLER! Missing default?")
            ),
            image: this.getImage(source),
        };
    }

    protected getWebgpuSamplerDescriptor(
        samplerIdx: number
    ): GPUSamplerDescriptor {
        const gSampler = nn(
            this.json.samplers?.[samplerIdx],
            "Sampler idx OOB"
        );

        return {
            addressModeU: GltfBinary.SAMPLER_TO_WGPU[gSampler.wrapS ?? 10497],
            addressModeV: GltfBinary.SAMPLER_TO_WGPU[gSampler.wrapT ?? 10497],
            minFilter: GltfBinary.getWebGpuSamplerFilter(
                gSampler.minFilter ?? 9728
            ),
            magFilter: GltfBinary.getWebGpuSamplerFilter(
                gSampler.magFilter ?? 9728
            ),
        };
    }

    protected getImage(imageIdx: number) {
        return nn(
            this.imageCache[imageIdx],
            "image OOB, did you forget to call prepareImages()"
        );
    }

    protected getMeshNoCache(mesh: number, primitive: number): Mesh {
        const gm = nn(this.json.meshes?.[mesh]);
        const gPrimitive = gm.primitives[primitive];
        const name = `mp:${gm.name ?? mesh}.p${primitive}`;

        const position = nn(
                gPrimitive.attributes["POSITION"],
                "Position is required!"
            ),
            normal = nn(
                gPrimitive.attributes["NORMAL"],
                "Normals are required!"
            ),
            texCoord = nn(
                gPrimitive.attributes["TEXCOORD_0"],
                "TexCoord is required!"
            ),
            indices = nn(
                gPrimitive.indices,
                "Non indexed geometry is not supported, unlucky."
            ),
            tangent = gPrimitive.attributes["TANGENT"];

        if (gPrimitive.mode !== undefined && gPrimitive.mode != 4) {
            throw new Error("Unsupported: non-triagle-list geometry");
        }

        const indexBuffer = GltfBinary.cacheOr(
                this.gpuBufferCache,
                indices,
                () =>
                    this.uploadAccesorToGpuWithAssertType(
                        indices,
                        "SCALAR",
                        Uint16Array,
                        GPUBufferUsage.INDEX,
                        `${name}:index`
                    )
            ),
            posBuffer = GltfBinary.cacheOr(this.gpuBufferCache, position, () =>
                this.uploadAccesorToGpuWithAssertType(
                    position,
                    "VEC3",
                    Float32Array,
                    GPUBufferUsage.VERTEX,
                    `${name}:position`
                )
            ),
            normBuffer = GltfBinary.cacheOr(this.gpuBufferCache, normal, () =>
                this.uploadAccesorToGpuWithAssertType(
                    normal,
                    "VEC3",
                    Float32Array,
                    GPUBufferUsage.VERTEX,
                    `${name}:normal`
                )
            ),
            texCoordBuffer = GltfBinary.cacheOr(
                this.gpuBufferCache,
                texCoord,
                () =>
                    this.uploadAccesorToGpuWithAssertType(
                        texCoord,
                        "VEC2",
                        Float32Array,
                        GPUBufferUsage.VERTEX,
                        `${name}:texCoord`
                    )
            ),
            tangentBuffer =
                tangent === undefined
                    ? undefined
                    : GltfBinary.cacheOr(this.gpuBufferCache, tangent, () =>
                          this.uploadAccesorToGpuWithAssertType(
                              tangent,
                              "VEC4",
                              Float32Array,
                              GPUBufferUsage.VERTEX,
                              `${name}:tangent`
                          )
                      );

        return new Mesh(
            posBuffer,
            normBuffer,
            texCoordBuffer,
            tangentBuffer,
            indexBuffer,
            this.json.accessors![gPrimitive.indices!].count! // This is just scuffed
        );
    }

    public getMeshP(mesh: number, primitive: number) {
        //FIXME(mbabnik): fix caching bullshit
        return GltfBinary.cacheOr(this.meshCache, (mesh << 4) | primitive, () =>
            this.getMeshNoCache(mesh, primitive)
        );
    }

    protected uploadTexture(index: number) {
        const image = this.getTextureImage(index);

        const texture = Game.gpu.device.createTexture({
            //TODO(mbabnik): Grab a label
            format: "rgba8unorm",
            viewFormats: ["rgba8unorm", "rgba8unorm-srgb"],
            size: [image.width, image.height],
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
            mipLevelCount: nMips(image.width, image.height),
        });

        Game.gpu.device.queue.copyExternalImageToTexture(
            { source: image },
            { texture },
            [image.width, image.height, 1]
        );

        generateMipmap(Game.gpu.device, texture);

        return texture;
    }

    protected getGpuTexture(index: number) {
        return GltfBinary.cacheOr(this.textureCache, index, () =>
            this.uploadTexture(index)
        );
    }

    protected getMaterialNoCache(idx: number): Material {
        const gMat = nn(this.json.materials?.[idx], "Mat IDX OOB");

        const pbr = nn(gMat.pbrMetallicRoughness, "Missing PBR component");

        const baseTex = pbr.baseColorTexture
            ? this.getGpuTexture(pbr.baseColorTexture.index)
            : undefined;
        const baseSampler = pbr.baseColorTexture
            ? Game.gpu.getSampler(
                  this.getTextureSamplerDescriptor(pbr.baseColorTexture.index)
              )
            : undefined;
        const baseFactor = pbr.baseColorFactor
            ? vec4.create(...pbr.baseColorFactor)
            : undefined;

        const mrTex = pbr.metallicRoughnessTexture
            ? this.getGpuTexture(pbr.metallicRoughnessTexture.index)
            : undefined;
        const mrSampler = pbr.metallicRoughnessTexture
            ? Game.gpu.getSampler(
                  this.getTextureSamplerDescriptor(
                      pbr.metallicRoughnessTexture.index
                  )
              )
            : undefined;
        const metalFactor = pbr.metallicFactor;
        const roughFactor = pbr.roughnessFactor;

        const emTex = gMat.emissiveTexture
            ? this.getGpuTexture(gMat.emissiveTexture.index)
            : undefined;
        const emSampler = gMat.emissiveTexture
            ? Game.gpu.getSampler(
                  this.getTextureSamplerDescriptor(gMat.emissiveTexture.index)
              )
            : undefined;
        const emFactor = gMat.emissiveFactor
            ? vec3.create(...gMat.emissiveFactor)
            : undefined;

        return new Material(
            {
                texture: baseTex,
                sampler: baseSampler,
                factor: baseFactor,
            },
            {
                texture: mrTex,
                sampler: mrSampler,
                metalFactor,
                roughFactor,
            },
            gMat.normalTexture
                ? {
                      texture: this.getGpuTexture(gMat.normalTexture.index),
                      sampler: Game.gpu.getSampler(
                          this.getTextureSamplerDescriptor(
                              gMat.normalTexture.index
                          )
                      ),
                      scale: gMat.normalTexture.scale ?? 1,
                  }
                : undefined,
            {
                factor: emFactor,
                sampler: emSampler,
                texture: emTex,
            },
            {
                alphaCutoff: gMat.alphaCutoff,
                mode: GltfBinary.ALPHA_MODE_MAP[gMat.alphaMode ?? "OPAQUE"],
            },
            gMat.name ?? "unknown"
        );
    }

    public getMaterial(idx: number): Material {
        return GltfBinary.cacheOr(this.materialCache, idx, () =>
            this.getMaterialNoCache(idx)
        );
    }

    public defaultScene(): TG.IScene {
        return nn(
            this.json.scenes?.[nn(this.json.scene, "No default scene")],
            "Default scene OOB"
        );
    }

    public getScene(id: number): TG.IScene;
    public getScene(name: string): TG.IScene;
    public getScene(arg: string | number) {
        if (typeof arg == "string") {
            return nn(
                this.json.scenes?.find((x) => x.name == arg),
                "No matching scene"
            );
        }

        return nn(this.json.scenes?.[arg], "Scene idx OOB");
    }

    public loadMeshToNode(node: SceneNode, idx: number) {
        const gMesh = nn(this.json.meshes?.[idx]);

        gMesh.primitives.forEach((p, i) => {
            const mp = this.getMeshP(idx, i);
            const mm = this.getMaterial(nn(p.material, "no material!"));
            node.addComponent(new MeshComponent(mp, mm, `mesh:${idx}-${i}`));
        });
    }

    public nodeConvert(index: number): SceneNode | undefined {
        const gNode = nn(this.json.nodes?.[index]);
        const node = new SceneNode();
        node.name = gNode.name ?? `${this.name}.nodes.${index}`;

        if (gNode.matrix) console.warn("glTF Matrices unsupported");

        if (gNode.extras) {
            // Don't load non-visual objects into scene
            if (gNode.extras["poi"]) return undefined;
            if (gNode.extras["colider"]) return undefined;
            if (gNode.extras["navmesh"]) return undefined;
        }

        // transform
        if (gNode.translation) {
            node.transform.translation.set(gNode.translation);
        }
        if (gNode.rotation) {
            node.transform.rotation.set(gNode.rotation);
        }
        if (gNode.scale) {
            node.transform.scale.set(gNode.scale);
        }
        node.transform.update();

        // meshes
        if (typeof gNode.mesh === "number") {
            this.loadMeshToNode(node, gNode.mesh);
        }

        // light
        const lightId = gNode.extensions?.KHR_lights_punctual?.light;
        if (typeof lightId === "number") {
            node.addComponent(
                new LightComponent(
                    this.getLight(lightId),
                    this.json.extensions?.KHR_lights_punctual?.lights[lightId]
                        ?.name ?? `Light${lightId}`
                )
            );
        }

        // children
        gNode.children?.forEach((c) => {
            const newNode = this.nodeConvert(c);
            if (newNode) node.addChild(newNode);
        });

        return node;
    }

    public sceneAsNode(index = 0): SceneNode {
        const scene = nn(this.json.scenes?.[index], "Scene idx OOB");
        const node = new SceneNode();
        node.name = scene.name ?? `${this.name}.scenes.${index}`;

        scene.nodes?.forEach((c) => {
            const newNode = this.nodeConvert(c);
            if (newNode) node.addChild(newNode);
        });

        return node;
    }

    public getLight(id: number): THondaLight {
        const gLight = nn(
            this.json.extensions?.KHR_lights_punctual?.lights[id],
            "Light ID OOB"
        );

        const color = gLight.color ?? [1, 1, 1],
            intensity = gLight.intensity ?? 1,
            maxRange = gLight.range ?? 100000,
            castShadows = !gLight.extras?.["_noshadow"];

        switch (gLight.type) {
            case "spot":
                return {
                    type: "spot",
                    color,
                    intensity,
                    maxRange,
                    castShadows,
                    innerCone: gLight.spot?.innerConeAngle ?? 0,
                    outerCone: gLight.spot?.outerConeAngle ?? Math.PI / 4,
                } satisfies ISpotLight;

            case "point":
                return {
                    type: "point",
                    color,
                    intensity,
                    maxRange,
                    castShadows,
                } satisfies IPointLight;

            case "directional":
                return {
                    type: "directional",
                    color,
                    intensity,
                    castShadows,
                } satisfies IDirectionalLight;

            default:
                throw new Error("Unknown light type" + gLight.type);
        }
    }

    public getStaticColiders(sceneIndex = 0): StaticAABBColider[] {
        const scene = nn(this.json.scenes?.[sceneIndex], "Scene idx OOB");
        const coliders: StaticAABBColider[] = [];

        for (const nodeIdx of scene.nodes ?? []) {
            const gColiderNode = nn(this.json.nodes?.[nodeIdx], "node idx OOB");

            const coliderLayers = gColiderNode.extras?.["colider"];
            if (!coliderLayers || typeof coliderLayers != "string") continue;

            const layers = coliderLayers
                .trim()
                .split(",")
                .reduce((p, c) => {
                    const key = c.trim().toLowerCase();
                    const bit = GltfBinary.COLIDER_LAYER_MAP[key] ?? 0;
                    if (bit == 0) console.warn(`Unknown colider layer: ${key}`);

                    return p | bit;
                }, 0);

            const pos = gColiderNode.translation;
            if (!pos) continue;
            const scale = gColiderNode.scale ?? [1, 1, 1];

            const { angle, axis } = quat.toAxisAngle(
                gColiderNode.rotation ?? [0, 0, 0, 0]
            );
            let flipXz = false;

            if (angle > 0) {
                if (
                    vec3.equalsApproximately(axis, [0, 1, 0]) ||
                    vec3.equalsApproximately(axis, [0, -1, 0])
                ) {
                    flipXz = !!(Math.round(angle / (Math.PI / 2)) % 2);
                } else if (vec3.length(axis) > 0.5) {
                    console.warn(
                        "unsupported quaternion rotation on AABB:",
                        gColiderNode.rotation,
                        angle,
                        axis
                    );
                    continue;
                }
            }

            const scaleX = Math.abs(scale[flipXz ? 2 : 0]),
                scaleY = Math.abs(scale[1]),
                scaleZ = Math.abs(scale[flipXz ? 0 : 2]);

            const colider = new StaticAABBColider(
                [pos[0] - scaleX, pos[1] - scaleY, pos[2] - scaleZ],
                [pos[0] + scaleX, pos[1] + scaleY, pos[2] + scaleZ],
                layers
            );
            colider.name = gColiderNode.name ?? `S${sceneIndex}.${nodeIdx}`;
            coliders.push(colider);
        }
        return coliders;
    }

    // eslint-disable-next-line class-methods-use-this
    protected tryToPoi(node: TG.TNode): POI | undefined {
        if (
            !node.translation ||
            !node.name ||
            !node.extras ||
            !node.extras.poi
        ) {
            return undefined;
        }

        return {
            name: node.name,
            position: node.translation,
            props: node.extras,
        };
    }

    public getPOIByName(name: string): POI | undefined {
        const potentialPoiNode = this.json.nodes?.find((x) => x.name === name);
        return potentialPoiNode && this.tryToPoi(potentialPoiNode);
    }

    public getAllPOIs(): POI[] {
        return (
            this.json.nodes
                ?.filter((x) => !!x.extras?.poi)
                .map((x) => this.tryToPoi(x))
                .filter<POI>((x) => !!x) ?? []
        );
    }

    // eslint-disable-next-line class-methods-use-this
    protected convertNavmesh(
        idxAcc: FavelaAccesor<Uint16Array, "SCALAR">,
        posAcc: FavelaAccesor<Float32Array, "VEC3">
    ): [number, number][][] {
        const idx = idxAcc.accessor,
            pos = posAcc.accessor;

        const polygons = [] as [number, number][][];

        for (let i = 0; i + 2 < idx.length; i += 3) {
            const ia = idx[i],
                ib = idx[i + 1],
                ic = idx[i + 2];

            polygons.push([
                [pos[3 * ia + 0], pos[3 * ia + 2]],
                [pos[3 * ib + 0], pos[3 * ib + 2]],
                [pos[3 * ic + 0], pos[3 * ic + 2]],
            ]);
        }

        return polygons;
    }

    public getNavmesh(scene: number = 0) {
        const navMesh = nn(
            this.json.meshes?.[
                this.json.scenes?.[0]?.nodes
                    ?.map((x) => this.json?.nodes?.[x])
                    .filter((x) => x)
                    .find((x) => x?.extras?.["navmesh"])?.mesh ?? -1
            ],
            `No navmesh nodes for scene ${scene}`
        );

        console.assert(
            navMesh.primitives.length == 1,
            "MULTIPLE PRIMITIVES IN NAVMESH!"
        );
        const prim = navMesh.primitives[0];

        const idxAccessor = this.getAccessorAndAssertType(
                nn(prim.indices, "namvesh indices missing"),
                "SCALAR",
                Uint16Array
            ),
            posAccessor = this.getAccessorAndAssertType(
                nn(prim.attributes["POSITION"], "namvesh indices missing"),
                "VEC3",
                Float32Array
            );

        return this.convertNavmesh(idxAccessor, posAccessor);
    }
}
