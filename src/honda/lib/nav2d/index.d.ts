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

export class Vector {
    constructor(x: number, y: number);
    add(other: Vector | number): Vector;
    sub(other: Vector | number): Vector;
    mul(other: Vector | number): Vector;
    div(other: Vector | number): Vector;
    length(): number;
    equals(other: Vector): boolean;
    angle(other: Vector): number;
    counterclockwiseAngle(other: Vector): number;
    toString(): string;
}
export function dot(a: Vector, b: Vector): number;
export function cross(a: Vector, b: Vector): number;
export function isclose(a: number, b: number, eps?: number): boolean;
export function clip(a: number, b: number, v: number): number;

export class Edge {
    constructor(p1: Point, p2: Point);
    p1: Vector;
    p2: Vector;
    length(): number;
    direction(): Vector;
    onEdge(point: Point): boolean;
    parallel(other: Edge): boolean;
    collinear(other: Edge): boolean;
    overlap(other: Edge): boolean | null;
    equals(other: Edge): boolean;
}

export class Polygon {
    constructor(points: Point[]);
    points: Vector[];
    bounds: [number, number, number, number];
    edges(): Edge[];
    centroid(): Vector;
    centroidDistance(other: Polygon): number;
    contains(point: Point): boolean;
    onEdge(point: Point): Edge | null;
    touches(otherEdge: Edge): Edge | null;
    boundsSize(): [number, number, number, number];
}
export class NavMesh {
    constructor(polygons: Point[][], options?: NavMeshOptions);
    polygons: Polygon[];
    pointQuerySize: number;
    findPath(from: Point, to: Point): Point[] | null;
}

export type Point = Vector | [number, number] | { x: number, y: number };
export interface NavMeshOptions {
    triangulate?: boolean;
    pointQuerySize?: number;
    costFunc?: (polygon1: Polygon, polygon2: Polygon, portal: Edge) => number;
    heuristicFunc?: (poly: Polygon, to: Polygon) => number;
}