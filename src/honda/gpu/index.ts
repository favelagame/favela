function nn<T>(value: T | null | undefined, message?: string): T {
    if (value === null) throw new Error(message ?? "value was null");
    if (value === undefined) throw new Error(message ?? "value was undefined");
    return value;
}

export class WebGpu {
    private ro: ResizeObserver;

    public pFormat = navigator.gpu.getPreferredCanvasFormat();
    public depthTexture: GPUTexture;

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

        this.depthTexture = this.device.createTexture({
            size: [canvas.width, canvas.height, 1],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });

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
    }

    static async obtainForCanvas(canvas: HTMLCanvasElement) {
        const adapter = nn(
            await navigator.gpu.requestAdapter({
                powerPreference: "high-performance",
            })
        );
        const device = nn(await adapter.requestDevice());
        const wg = nn(canvas.getContext("webgpu"));

        canvas.width = document.body.clientWidth;
        canvas.height = document.body.clientHeight;

        wg.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat(),
        });

        return new WebGpu(adapter, device, canvas, wg);
    }
}
