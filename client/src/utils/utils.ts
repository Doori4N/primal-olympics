/**
 * Linear interpolation between two numbers
 * @param start
 * @param end
 * @param t
 */
export const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
}