import { Game } from "../state";
import { nn } from "../util";
import { createBindGroupLayouts } from "./bindGroupLayouts";
import { createTexturedMeshInstanced } from "./pipelines/instancedTexturedMesh.pipeline";
import { createPostProcess } from "./pipelines/postprocess.pipeline";
import { createSSAO } from "./pipelines/ssao.pipeline";
import { createModules } from "./shaders";

const N_MAP_BUFFERS = 4;
const TIMESTAMP_PASS_CAPACITY = 16;

export class WebGpu {
    private ro: ResizeObserver;

    public ssaoTexture!: GPUTexture;
    public depthTexture!: GPUTexture;
    public colorTexture!: GPUTexture;
    public canvasTexture!: GPUTexture;
    public normalTexture!: GPUTexture;

    public ssaoTextureView!: GPUTextureView;
    public depthTextureView!: GPUTextureView;
    public colorTextureView!: GPUTextureView;
    public canvasTextureView!: GPUTextureView;
    public normalTextureView!: GPUTextureView;

    public pFormat = navigator.gpu.getPreferredCanvasFormat();
    public shaderModules = createModules(this);
    public bindGroupLayouts = createBindGroupLayouts(this);
    public pipelines = {
        instancedTextured: createTexturedMeshInstanced(this),
        post: createPostProcess(this),
        ssao: createSSAO(this),
    };

    public wasResized = false;

    public renderScale = 1;

    protected gpuSamplerMap: Record<string, GPUSampler> = {};

    protected querySet: GPUQuerySet;
    protected queryBuffer: GPUBuffer;
    protected acitveMapBuffer = 0;
    protected queryMapBuffers: GPUBuffer[];
    protected queryIndex: number = 0;
    // FIXME(mbabnik): Due to GPUs being a scam, this can get desynced,
    // if a frame has different ammount of passes than the previous one.
    // Due to GPUs being a scam (taking time to map memory). 
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

        this.createTexturesAndViews();
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

        // I wish there was a better way
        this.queryMapBuffers = [...Array(N_MAP_BUFFERS)].map((_, i) =>
            device.createBuffer({
                label: `MapBuffer${i + 1}`,
                size: 8 * 2 * TIMESTAMP_PASS_CAPACITY,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            })
        );

        // FIXME: Safari (matter reference) doesn't support this.
        this.ro.observe(canvas, { box: "device-pixel-content-box" });
    }

    public get aspectRatio() {
        return this.canvas.width / this.canvas.height;
    }

    protected createTexturesAndViews() {
        const size = [this.canvas.width, this.canvas.height, 1];
        const usage =
            GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

        this.ssaoTexture?.destroy();
        this.depthTexture?.destroy();
        this.colorTexture?.destroy();
        this.normalTexture?.destroy();

        this.ssaoTexture = this.device.createTexture({
            format: "r8unorm",
            size,
            usage,
        });
        this.colorTexture = this.device.createTexture({
            format: "rgba8unorm",
            size,
            usage,
        });
        this.depthTexture = this.device.createTexture({
            size,
            format: "depth24plus",
            usage,
        });
        this.normalTexture = this.device.createTexture({
            format: "rgba8unorm",
            size,
            usage,
        });
        this.canvasTexture = this.ctx.getCurrentTexture();

        this.ssaoTextureView = this.ssaoTexture.createView();
        this.depthTextureView = this.depthTexture.createView();
        this.colorTextureView = this.colorTexture.createView();
        this.normalTextureView = this.normalTexture.createView();
        this.canvasTextureView = this.canvasTexture.createView();
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

        this.createTexturesAndViews();
        this.wasResized = true;
    }

    public frameStart() {
        // Chrome seems to pass a "new?" frame every time, firefox reuses the same one
        if (this.canvasTexture != this.ctx.getCurrentTexture()) {
            this.canvasTexture = this.ctx.getCurrentTexture();
            this.canvasTextureView = this.canvasTexture.createView();
        }
        this.queryIndex = 0;
    }

    public pushQueue() {
        Game.cmdEncoder.resolveQuerySet(
            this.querySet,
            0,
            this.queryIndex,
            this.queryBuffer,
            0
        );

        const activeBuffer = this.queryMapBuffers[this.acitveMapBuffer];

        if (this.queryIndex != 0 && this.queryBuffer.mapState === "unmapped") {
            Game.cmdEncoder.copyBufferToBuffer(
                this.queryBuffer,
                0,
                activeBuffer,
                0,
                this.queryBuffer.size
            );
        }
        this.device.queue.submit([Game.cmdEncoder.finish()]);

        if (this.queryIndex != 0 && activeBuffer.mapState === "unmapped") {
            this.acitveMapBuffer++;
            this.acitveMapBuffer %= N_MAP_BUFFERS;
            activeBuffer.mapAsync(GPUMapMode.READ).then(() => {
                const times = new BigInt64Array(activeBuffer.getMappedRange());
                Game.perf.sumbitGpuTimestamps(this.timestampLabels, times, this.queryIndex>>1)
                activeBuffer.unmap();
            });
        }

        Game.cmdEncoder = this.device.createCommandEncoder();
    }

    public getSampler(d: GPUSamplerDescriptor) {
        const key = `${d.addressModeU!}${d.addressModeV!}${d.minFilter!}${d.magFilter!}`;
        let h = this.gpuSamplerMap[key];
        if (h) return h;

        this.gpuSamplerMap[key] = h = this.device.createSampler(d);
        return h;
    }

    public timestamp(label: string): GPURenderPassTimestampWrites {
        if (this.queryIndex + 2 > TIMESTAMP_PASS_CAPACITY) {
            throw new Error("Not enough space for timestamps");
        }

        this.timestampLabels[this.queryIndex >> 1] = label;

        return {
            querySet: this.querySet,
            beginningOfPassWriteIndex: this.queryIndex++,
            endOfPassWriteIndex: this.queryIndex++,
        } satisfies GPURenderPassTimestampWrites;
    }
}
