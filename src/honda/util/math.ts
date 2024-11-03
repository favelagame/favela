export function clamp(min: number, x: number, max: number) {
    if (x < min) return min;
    if (x > max) return max;
    return x;
}

export const PI_2 = Math.PI / 2;
