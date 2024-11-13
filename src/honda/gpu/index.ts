import { Game } from "../state";
import { nn } from "../util";
import { createBindGroupLayouts } from "./bindGroupLayouts";
import { createBasicMeshInstanced } from "./pipelines/instancedBasicMesh.pipeline";
import { createTexturedMeshInstanced } from "./pipelines/instancedTexturedMesh.pipeline";
import { createPostProcess } from "./pipelines/post.pipeline";
import { createModules } from "./shaders";

export class WebGpu {
    private ro: ResizeObserver;

    public depthTexture: GPUTexture;
    public canvasTexture: GPUTexture;
    public renderTexture: GPUTexture;

    public depthTextureView: GPUTextureView;
    public renderTextureView: GPUTextureView;
    public canvasTextureView: GPUTextureView;

    public pFormat = navigator.gpu.getPreferredCanvasFormat();
    public shaderModules = createModules(this);
    public bindGroupLayouts = createBindGroupLayouts(this);
    public pipelines = {
        instancedBasic: createBasicMeshInstanced(this),
        instancedTextured: createTexturedMeshInstanced(this),
        post: createPostProcess(this),
    };

    public wasResized = false;

    protected gpuSamplerMap: Record<string, GPUSampler> = {};

    static async obtainForCanvas(canvas: HTMLCanvasElement) {
        const adapter = nn(
            await navigator.gpu.requestAdapter({
                powerPreference: "high-performance",
            }),
            "Your browser doesn't support WebGPU"
        );
        const device = nn(
            await adapter.requestDevice(),
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
        console.info(adapter.info);
        console.log("features", device.features);
        console.info(device.limits);
        console.groupEnd();

        this.canvasTexture = this.ctx.getCurrentTexture();
        this.renderTexture = this.device.createTexture({
            format: this.pFormat,
            size: [canvas.width, canvas.height, 1],
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
        });
        this.depthTexture = this.device.createTexture({
            size: [canvas.width, canvas.height, 1],
            format: "depth24plus",
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
        });
        this.canvasTextureView = this.canvasTexture.createView();
        this.renderTextureView = this.renderTexture.createView();
        this.depthTextureView = this.depthTexture.createView();

        this.ro = new ResizeObserver((e) => this.handleResize(e));
        // FIXME: Safari (matter reference) doesn't support this.
        this.ro.observe(canvas, { box: "device-pixel-content-box" });
    }

    public get aspectRatio() {
        return this.canvas.width / this.canvas.height;
    }

    private handleResize([e]: ResizeObserverEntry[]) {
        this.canvas.width = nn(e.devicePixelContentBoxSize?.[0].inlineSize);
        this.canvas.height = nn(e.devicePixelContentBoxSize?.[0].blockSize);

        this.depthTexture.destroy();
        this.renderTexture.destroy();

        this.depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height, 1],
            format: "depth24plus",
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
        });

        this.renderTexture = this.device.createTexture({
            format: this.pFormat,
            size: [this.canvas.width, this.canvas.height, 1],
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
        });

        this.renderTextureView = this.renderTexture.createView();
        this.depthTextureView = this.depthTexture.createView();
        this.wasResized = true;
    }

    public frameStart() {
        // Chrome seems to pass a "new?" frame every time, firefox reuses the same one
        if (this.canvasTexture != this.ctx.getCurrentTexture()) {
            this.canvasTexture = this.ctx.getCurrentTexture();
            this.canvasTextureView = this.canvasTexture.createView();
        }
    }

    public pushQueue() {
        this.device.queue.submit([Game.cmdEncoder.finish()]);
        Game.cmdEncoder = this.device.createCommandEncoder();
    }

    public getSampler(d: GPUSamplerDescriptor) {
        const key = `${d.addressModeU!}${d.addressModeV!}${d.minFilter!}${d.magFilter!}`;
        let h = this.gpuSamplerMap[key];
        if (h) return h;

        this.gpuSamplerMap[key] = h = this.device.createSampler(d);
        return h;
    }
}
