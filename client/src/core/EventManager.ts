export class EventManager {
    private listeners = new Map<string, Function[]>();

    constructor() {}

    /**
     * Subscribes to an event with a callback
     * @param eventName
     * @param callback
     */
    public subscribe(eventName: string, callback: Function): void {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        this.listeners.get(eventName)?.push(callback);
    }

    /**
     * Unsubscribes from an event
     * @param eventName
     * @param callback
     */
    public unsubscribe(eventName: string, callback: Function): void {
        if (!this.listeners.has(eventName)) {
            return;
        }

        const callbacks: Function[] | undefined = this.listeners.get(eventName);

        if (!callbacks) {
            return;
        }

        const index: number = callbacks.indexOf(callback);

        if (index === -1) {
            return;
        }

        callbacks.splice(index, 1);
    }

    /**
     * Notifies all subscribers of an event
     * @param eventName
     * @param args
     */
    public notify(eventName: string, ...args: any[]): void {
        if (!this.listeners.has(eventName)) {
            return;
        }

        const callbacks: Function[] | undefined = this.listeners.get(eventName);

        if (!callbacks) {
            return;
        }

        callbacks.forEach((callback: Function): void => {
            callback(...args);
        });
    }

    /**
     * Clears all listeners
     */
    public clear(): void {
        this.listeners.clear();
    }
}