import { Mat4, vec3, quat, mat4 } from "wgpu-matrix";

/**
 * transform? trans form
 * TRANS FEM
 * 🏳️‍⚧️🏳️‍⚧️🏳️‍⚧️🏳️‍⚧️🏳️‍⚧️🏳️‍⚧️🏳️‍⚧️🏳️‍⚧️🏳️‍⚧️🏳️‍⚧️🏳️‍⚧️🏳️‍⚧️🏳️‍⚧️
 * woke agenda cultural marxism
 */
export class Transform {
    private _locMtx: Mat4;
    private _locInvMtx: Mat4;
    public $glbMtx: Mat4;
    public $glbInvMtx: Mat4;
    public dirty = false;

    constructor(
        public translation = vec3.create(),
        public rotation = quat.identity(),
        public scale = vec3.create(1, 1, 1)
    ) {
        this._locMtx = mat4.identity();
        this._locInvMtx = mat4.identity();
        this.$glbMtx = mat4.identity();
        this.$glbInvMtx = mat4.identity();
        this.updateLocal();
    }

    public update() {
        this.dirty = true;
    }

    private _scratch = mat4.create();
    private updateLocal() {
        mat4.identity(this._locMtx);
        mat4.translate(this._locMtx, this.translation, this._locMtx);
        mat4.multiply(
            this._locMtx,
            mat4.fromQuat(this.rotation, this._scratch),
            this._locMtx
        );
        mat4.scale(this._locMtx, this.scale, this._locMtx);

        mat4.inverse(this._locMtx, this._locInvMtx);
        this.dirty = false;
    }

    public $updateGlobal(parent: Transform) {
        if (this.dirty) this.updateLocal();
        mat4.mul(parent.$glbMtx, this._locMtx, this.$glbMtx);
        mat4.mul(this._locInvMtx, parent.$glbInvMtx, this.$glbInvMtx);
    }

    public get localMatrix() {
        if (this.dirty) this.updateLocal();
        return this._locMtx;
    }

    public get localInvMatrix() {
        if (this.dirty) this.updateLocal();
        return this._locInvMtx;
    }
}
