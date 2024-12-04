import { Game } from "../state";
import { nn } from "../util";
import { createBindGroupLayouts } from "./bindGroupLayouts";
import { createTexturedMeshInstanced } from "./pipelines/instancedTexturedMesh.pipeline";
import { createPostProcess } from "./pipelines/postprocess.pipeline";
import { createShade } from "./pipelines/shade.pipeline";
import { createSky } from "./pipelines/sky.pipeline";
import { createSSAO } from "./pipelines/ssao.pipeline";
import { createModules } from "./shaders";
import { HondaTexture } from "./tex";

const TIMESTAMP_PASS_CAPACITY = 16;

export class WebGpu {
    private ro: ResizeObserver;

    public textures = {
        base: new HondaTexture("rgba8unorm-srgb", 1, "g-base"),
        normal: new HondaTexture("rgba8unorm", 1, "g-normal"),
        mtlRgh: new HondaTexture("rg8unorm", 1, "g-metal-rough"),
        emission: new HondaTexture("rgba8unorm", 1, "g-emission"),
        depth: new HondaTexture("depth24plus", 1, "g-depth"),
        ssao: new HondaTexture("r8unorm", 1, "ssao"),
        shaded: new HondaTexture("rgba16float", 1, "shaded"),
    };

    public canvasTexture!: GPUTexture;
    public canvasView!: GPUTextureView;

    public pFormat = navigator.gpu.getPreferredCanvasFormat();
    public shaderModules = createModules(this);
    public bindGroupLayouts = createBindGroupLayouts(this);
    public pipelines = {
        instancedTextured: createTexturedMeshInstanced(this),
        post: createPostProcess(this),
        ssao: createSSAO(this),
        shade: createShade(this),
        sky: createSky(this),
    };

    public wasResized = false;

    public renderScale = 1;

    protected gpuSamplerMap: Record<string, GPUSampler> = {};

    protected querySet: GPUQuerySet;
    protected queryIndex = 0;
    protected queryBuffer: GPUBuffer;
    protected queryMapBuffer: GPUBuffer;
    protected wasQueryReady = false;
    protected timestampLabels: Record<number, string> = {};

    static async obtainForCanvas(canvas: HTMLCanvasElement) {
        const adapter = nn(
            await navigator.gpu.requestAdapter({
                powerPreference: "high-performance",
            }),
            "Your browser doesn't support WebGPU"
        );
        const device = nn(
            await adapter.requestDevice({
                requiredFeatures: ["timestamp-query"],
            }),
            "Couldn't obtain WebGPU device"
        );
        const wg = nn(
            canvas.getContext("webgpu"),
            "Couldn't obtain WebGPU context"
        );

        canvas.width = document.body.clientWidth;
        canvas.height = document.body.clientHeight;

        wg.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat(),
        });

        return new WebGpu(adapter, device, canvas, wg);
    }

    constructor(
        public readonly adapter: GPUAdapter,
        public readonly device: GPUDevice,
        public readonly canvas: HTMLCanvasElement,
        public readonly ctx: GPUCanvasContext
    ) {
        console.groupCollapsed("GPU info");
        console.log("PREFERED FORMAT:", this.pFormat);
        console.info(adapter.info);
        console.log("features", device.features);
        console.info(device.limits);
        console.groupEnd();

        this.resizeTextures();
        this.ro = new ResizeObserver((e) => this.handleResize(e));

        this.querySet = device.createQuerySet({
            type: "timestamp",
            count: 2 * TIMESTAMP_PASS_CAPACITY,
        });
        this.queryBuffer = device.createBuffer({
            size: 8 * 2 * TIMESTAMP_PASS_CAPACITY,
            usage:
                GPUBufferUsage.QUERY_RESOLVE |
                GPUBufferUsage.STORAGE |
                GPUBufferUsage.COPY_SRC,
        });
        this.queryMapBuffer = device.createBuffer({
            label: "MapBuffer",
            size: 8 * 2 * TIMESTAMP_PASS_CAPACITY,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        // FIXME: Safari (matter reference) doesn't support this.
        this.ro.observe(canvas, { box: "device-pixel-content-box" });
    }

    public get aspectRatio() {
        return this.canvas.width / this.canvas.height;
    }

    protected resizeTextures() {
        Object.values(this.textures).forEach((t) =>
            t.resize(this.device, this.canvas.width, this.canvas.height)
        );
    }

    private handleResize([e]: ResizeObserverEntry[]) {
        this.canvas.width =
            Math.round(
                nn(e.devicePixelContentBoxSize?.[0].inlineSize) *
                    this.renderScale
            ) & ~1;
        this.canvas.height =
            Math.round(
                nn(e.devicePixelContentBoxSize?.[0].blockSize) *
                    this.renderScale
            ) & ~1;

        this.resizeTextures();
        this.wasResized = true;
    }

    public frameStart() {
        // Chrome seems to pass a "new?" frame every time, firefox reuses the same one
        if (this.canvasTexture != this.ctx.getCurrentTexture()) {
            this.canvasTexture = this.ctx.getCurrentTexture();
            this.canvasView = this.canvasTexture.createView();
        }

        this.queryIndex = 0;
        this.wasQueryReady = this.queryMapBuffer.mapState == "unmapped";
    }

    /**
     * This used to be called pushQueue (it does push the queue),
     * it got renamed it to end Frame because:
     *  - we aim for a single queue push per frame
     *  - gpu timing code assumes we do everything in one queue push
     */
    public endFrame() {
        Game.cmdEncoder.resolveQuerySet(
            this.querySet,
            0,
            this.queryIndex,
            this.queryBuffer,
            0
        );

        if (this.wasQueryReady) {
            const readBuf = this.queryMapBuffer;
            Game.cmdEncoder.copyBufferToBuffer(
                this.queryBuffer,
                0,
                readBuf,
                0,
                this.queryBuffer.size
            );

            this.device.queue.submit([Game.cmdEncoder.finish()]);

            readBuf.mapAsync(GPUMapMode.READ).then(() => {
                const times = new BigInt64Array(readBuf.getMappedRange());
                Game.perf.sumbitGpuTimestamps(
                    this.timestampLabels,
                    times,
                    this.queryIndex >> 1
                );
                readBuf.unmap();
            });
        } else {
            this.device.queue.submit([Game.cmdEncoder.finish()]);
        }
        Game.cmdEncoder = this.device.createCommandEncoder();
    }

    public timestamp(label: string): GPURenderPassTimestampWrites | undefined {
        if (!this.wasQueryReady) return;
        if (this.queryIndex + 2 > TIMESTAMP_PASS_CAPACITY) {
            console.warn("Not enough space for timestamps");
            return;
        }

        this.timestampLabels[this.queryIndex >> 1] = label;

        return {
            querySet: this.querySet,
            beginningOfPassWriteIndex: this.queryIndex++,
            endOfPassWriteIndex: this.queryIndex++,
        } satisfies GPURenderPassTimestampWrites;
    }

    public getSampler(d: GPUSamplerDescriptor) {
        const key = `${d.addressModeU!}${d.addressModeV!}${d.minFilter!}${d.magFilter!}`;
        let h = this.gpuSamplerMap[key];
        if (h) return h;

        this.gpuSamplerMap[key] = h = this.device.createSampler(d);
        return h;
    }
}
