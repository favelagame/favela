/*
    Copyright (c) 2020 Francesco Pasa
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/
export const EPS = 1e-8;

export class Vector {
    constructor(x, y) {
        if (typeof x !== "number" || typeof y !== "number") {
            throw new Error("Vector components must be numbers.");
        }

        this.x = x;
        this.y = y;
    }

    _normOther(other) {
        if (typeof other == "number") {
            return new Vector(other, other);
        }
        return other;
    }

    add(other) {
        other = this._normOther(other);
        return new Vector(this.x + other.x, this.y + other.y);
    }

    sub(other) {
        other = this._normOther(other);
        return new Vector(this.x - other.x, this.y - other.y);
    }

    mul(other) {
        other = this._normOther(other);
        return new Vector(this.x * other.x, this.y * other.y);
    }

    div(other) {
        other = this._normOther(other);
        return new Vector(this.x / other.x, this.y / other.y);
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    equals(other) {
        return isclose(this.x, other.x) && isclose(this.y, other.y);
    }

    angle(other) {
        return Math.acos(
            clip(-1, 1, dot(this, other) / (this.length() * other.length()))
        );
    }

    counterclockwiseAngle(other) {
        const angle = this.angle(other);
        return cross(this, other) >= 0 ? angle : 2 * Math.PI - angle;
    }

    toString() {
        return `{ x: ${this.x}, y: ${this.y} }`;
    }
}

export function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}

export function cross(a, b) {
    return a.x * b.y - a.y * b.x;
}

export function isclose(a, b, eps = EPS) {
    return a > b - eps && a < b + eps;
}

export function clip(a, b, v) {
    if (v < a) return a;
    if (v > b) return b;
    return v;
}
