import { Game } from "../state";
import { nn } from "../util";
import { createBindGroupLayouts } from "./bindGroupLayouts";
import { createTexturedMeshInstanced } from "./pipelines/instancedTexturedMesh.pipeline";
import { createPostProcess } from "./pipelines/post.pipeline";
import { createModules } from "./shaders";

export class WebGpu {
    private ro: ResizeObserver;

    public depthTexture: GPUTexture;
    public colorTexture: GPUTexture;
    public canvasTexture: GPUTexture;
    public normalTexture: GPUTexture;

    public depthTextureView: GPUTextureView;
    public colorTextureView: GPUTextureView;
    public canvasTextureView: GPUTextureView;
    public normalTextureView: GPUTextureView;

    public pFormat = navigator.gpu.getPreferredCanvasFormat();
    public shaderModules = createModules(this);
    public bindGroupLayouts = createBindGroupLayouts(this);
    public pipelines = {
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
        console.log('PREFERED FORMAT:', this.pFormat)
        console.info(adapter.info);
        console.log("features", device.features);
        console.info(device.limits);
        console.groupEnd();

        this.canvasTexture = this.ctx.getCurrentTexture();
        this.colorTexture = this.device.createTexture({
            format: 'rgba8unorm',
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
        this.normalTexture = this.device.createTexture({
            format: 'rgba8unorm',
            size: [canvas.width, canvas.height, 1],
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
        });

        this.canvasTextureView = this.canvasTexture.createView();
        this.normalTextureView = this.normalTexture.createView();
        this.colorTextureView = this.colorTexture.createView();
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

        this.normalTexture.destroy();
        this.depthTexture.destroy();
        this.colorTexture.destroy();

        this.colorTexture = this.device.createTexture({
            format: 'rgba8unorm',
            size: [this.canvas.width, this.canvas.height, 1],
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
        });
        this.depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height, 1],
            format: "depth24plus",
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
        });
        this.normalTexture = this.device.createTexture({
            format: 'rgba8unorm',
            size: [this.canvas.width, this.canvas.height, 1],
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
        });

        this.normalTextureView = this.normalTexture.createView();
        this.colorTextureView = this.colorTexture.createView();
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
