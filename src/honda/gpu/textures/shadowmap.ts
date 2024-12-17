export class ShadowMapTexture {
    public tex!: GPUTexture;
    public view!: GPUTextureView;
    public views: GPUTextureView[] = [];

    constructor(
        public nLights: number,
        public size = 1024,
        public label: string | undefined = undefined
    ) {}

    public alloc(dev: GPUDevice) {
        this.tex?.destroy();
        this.tex = dev.createTexture({
            format: "depth24plus",
            size: [this.size, this.size, this.nLights],
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
            dimension: "2d",
            label: this.label,
        });

        this.view = this.tex.createView({
            label: `${this.label ?? "<shadow>"}:main`,
            arrayLayerCount: this.nLights,
        });

        this.views.length = this.size;
        for (let i = 0; i < this.nLights; i++) {
            this.views[i] = this.tex.createView({
                label: `${this.label ?? "<shadow>"}:light-${i}`,
                baseArrayLayer: i,
                arrayLayerCount: 1,
            });
        }
    }
}
