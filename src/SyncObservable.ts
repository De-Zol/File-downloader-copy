export class SyncObservable<T> {
    private _values: T[] = [];
    private _isPrevCallbackCompleted = true;
    constructor(private _callback: (nextValue: T) => Promise<any>) {}

    public async next(nextValue: T) {
        if (!this._isPrevCallbackCompleted) {
            this._values.push(nextValue);
            return;
        }

        this._execCallback(nextValue);
    }

    private async _execCallback(value: T) {
        this._isPrevCallbackCompleted = false;
        await this._callback(value);
        if (this._values.length) {
            const nextValue = this._values.shift();
            await this._execCallback(nextValue);
        }
        this._isPrevCallbackCompleted = true;
    }
}
