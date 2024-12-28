export class ViewportPingPongTexture<Tformat extends GPUTextureFormat> {
    public tex!: GPUTexture;
    public views!: [GPUTextureView, GPUTextureView];

    constructor(
        public format: Tformat,
        public renderScale: number = 1,
        public label = "<unk>"
    ) {}

    public resize(dev: GPUDevice, viewportW: number, viewportH: number) {
        this.tex?.destroy();
        this.tex = dev.createTexture({
            format: this.format,
            size: [viewportW, viewportH, 2],
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
            dimension: "2d",
            label: `${this.label}:A`,
        });

        this.views = [
            this.tex.createView({
                baseArrayLayer: 0,
                arrayLayerCount: 1,
                dimension: '2d',
                label: `${this.label}:A`,
            }),
            this.tex.createView({
                baseArrayLayer: 1,
                arrayLayerCount: 1,
                dimension: '2d',
                label: `${this.label}:B`,
            }),
        ];
    }
}
