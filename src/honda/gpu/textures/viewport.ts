export class ViewportTexture<Tformat extends GPUTextureFormat> {
    public tex!: GPUTexture;
    public view!: GPUTextureView;

    constructor(
        public format: Tformat,
        public renderScale: number = 1,
        public label: string | undefined = undefined
    ) {}

    public resize(dev: GPUDevice, viewportW: number, viewportH: number) {
        this.tex?.destroy();
        this.tex = dev.createTexture({
            format: this.format,
            size: [viewportW, viewportH],
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
            dimension: "2d",
            label: this.label,
        });

        this.view = this.tex.createView({
            label: `${this.label ?? "<unk>"}:default`,
        }); // fries in bag
    }
}
