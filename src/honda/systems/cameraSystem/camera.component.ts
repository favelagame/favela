import { Game } from "@/honda/state";
import { mat4 } from "wgpu-matrix";

export class CameraComponent {
    public active = true;

    protected projectionMatrix = mat4.create();
    protected dirty = true;

    public constructor(
        protected _fov: number,
        protected _near: number,
        protected _far: number
    ) {
        this.recompute();
    }

    public get fov() {
        return this._fov;
    }

    public set fov(x: number) {
        if (x != this._fov) {
            this._fov = x;
            this.dirty = true;
        }
    }
    public get near() {
        return this._near;
    }

    public set near(x: number) {
        if (x != this._near) {
            this._near = x;
            this.dirty = true;
        }
    }

    public get far() {
        return this._far;
    }

    public set far(x: number) {
        if (x != this._far) {
            this._far = x;
            this.dirty = true;
        }
    }

    protected recompute() {
        mat4.perspective(
            (this._fov * Math.PI) / 180,
            Game.gpu.aspectRatio,
            this._near,
            this._far,
            this.projectionMatrix
        );
    }

    public get matrix() {
        if (this.dirty) this.recompute();
        return this.projectionMatrix;
    }
}
