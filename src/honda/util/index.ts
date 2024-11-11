/**
 * Not null/undefined assertion
 */
export function nn<T>(value: T | null | undefined, message?: string): T {
    if (value === null) throw new Error(message ?? "value was null");
    if (value === undefined) throw new Error(message ?? "value was undefined");
    return value;
}

export function clamp(min: number, x: number, max: number) {
    if (x < min) return min;
    if (x > max) return max;
    return x;
}

export const PI_2 = Math.PI / 2;
