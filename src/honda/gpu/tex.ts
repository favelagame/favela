
export class HondaTexture<Tformat extends GPUTextureFormat> {
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
            size: [viewportW, viewportH], //TODO apply render scale
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
            dimension: "2d",
            label: this.label,
            // TODO(mbabnik) mips?
            // TODO(mbabnik) MSAA?
        });

        this.view = this.tex.createView(); // fries in bag
    }
}
