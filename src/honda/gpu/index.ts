import { nn } from "../util";
import { Game } from "../state";
import { Limits } from "../limits";
import { createModules } from "./shaders";
import { createPipelines } from "./pipelines";
import { ViewportTexture } from "./textures/viewport";
import { ShadowMapTexture } from "./textures";
import { createBindGroupLayouts } from "./bindGroupLayouts";
import { ViewportPingPongTexture } from "./textures/viewportPingPong";

export class WebGpu {
    private ro: ResizeObserver;

    public textures = {
        base: new ViewportTexture("rgba8unorm-srgb", 1, "g-base"),
        normal: new ViewportTexture("rgba8unorm", 1, "g-normal"),
        mtlRgh: new ViewportTexture("rg8unorm", 1, "g-metal-rough"),
        emission: new ViewportTexture("rgba8unorm", 1, "g-emission"),
        depth: new ViewportTexture("depth24plus", 1, "g-depth"),
        ssao: new ViewportTexture("r8unorm", 1, "ssao"),
        shaded: new ViewportTexture("rgba16float", 1, "shaded"),
        bloom: new ViewportPingPongTexture("rgba16float", 1, "bloom"),
    };

    public shadowmaps = new ShadowMapTexture(
        Limits.MAX_SHADOWMAPS,
        Game.flags.has("shadowLow") ? 512 : 1024,
        "shadowmaps"
    );

    public canvasTexture!: GPUTexture;
    public canvasView!: GPUTextureView;

    public pFormat = navigator.gpu.getPreferredCanvasFormat();
    public shaderModules = createModules(this);
    public bindGroupLayouts = createBindGroupLayouts(this);
    public pipelines = createPipelines(this);

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
        console.log(
            "%cFavela/Honda (WebGPU)",
            "font-family: sans-serif; font-weight: bold; font-size: 2rem; color: #f44; background-color: black; padding: 1rem"
        );
        console.log(
            `%cGPU: %c${adapter.info.description}`,
            "font-family: sans-serif; font-weight: bold; font-size: 1rem",
            "font-family: sans-serif; font-size: 1rem"
        );
        console.groupCollapsed("GPUInfo");
        console.log("Prefered fmt:", this.pFormat);
        console.info(adapter.info);
        console.table(device.limits);
        console.groupEnd();

        this.resizeTextures();
        this.shadowmaps.alloc(this.device);
        this.ro = new ResizeObserver((e) => this.handleResize(e));

        this.querySet = device.createQuerySet({
            type: "timestamp",
            count: 2 * Limits.MAX_GPU_TIMESTAMPS,
        });
        this.queryBuffer = device.createBuffer({
            size: 8 * 2 * Limits.MAX_GPU_TIMESTAMPS,
            usage:
                GPUBufferUsage.QUERY_RESOLVE |
                GPUBufferUsage.STORAGE |
                GPUBufferUsage.COPY_SRC,
        });
        this.queryMapBuffer = device.createBuffer({
            label: "MapBuffer",
            size: 8 * 2 * Limits.MAX_GPU_TIMESTAMPS,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        this.renderScale = Game.flags.has("rsHalf") ? 0.5 : 1;

        /*
            FIXME:  Safari (matter reference) doesn't support this.
            TODO:   a lah nekdo figure-a out ta scaling,
                    basically hocmo hittat native res 
                    (think about retina, scaling)
        */
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
            this.canvasView = this.canvasTexture.createView({
                label: "canvasView",
            });
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
        if (this.queryIndex + 2 > Limits.MAX_GPU_TIMESTAMPS) {
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
