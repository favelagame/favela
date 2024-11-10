import { Game } from "../state";

function nn<T>(value: T | null | undefined, message?: string): T {
    if (value === null) throw new Error(message ?? "value was null");
    if (value === undefined) throw new Error(message ?? "value was undefined");
    return value;
}

export class WebGpu {
    private ro: ResizeObserver;

    public depthTextureView: GPUTextureView;
    public canvasTextureView: GPUTextureView;

    public depthTexture: GPUTexture;
    public canvasTexture: GPUTexture;

    public pFormat = navigator.gpu.getPreferredCanvasFormat();

    constructor(
        public readonly adapter: GPUAdapter,
        public readonly device: GPUDevice,
        public readonly canvas: HTMLCanvasElement,
        public readonly ctx: GPUCanvasContext
    ) {
        console.groupCollapsed("GPU info");
        console.table(adapter.info);
        console.log("features", device.features);
        console.table(device.limits);
        console.groupEnd();

        this.canvasTexture = this.ctx.getCurrentTexture();
        this.canvasTextureView = this.canvasTexture.createView();
        this.depthTexture = this.device.createTexture({
            size: [canvas.width, canvas.height, 1],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
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
        this.depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height, 1],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.depthTextureView = this.depthTexture.createView();
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
}
