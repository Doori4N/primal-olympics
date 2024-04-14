export class Utils {
    /**
     * Linear interpolation between two numbers
     * @param a first number
     * @param b second number
     * @param n interpolation value between 0 and 1
     */
    public static lerp(a: number, b: number, n: number): number {
        return a + (b - a) * n;
    }


    /**
     * Shuffles array in place.
     */
    public static shuffle<T>(array: T[]): void {
        for (let i: number = array.length - 1; i > 0; i--) {
            const j: number = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}