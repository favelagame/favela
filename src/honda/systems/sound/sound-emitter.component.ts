import { IComponent } from "@/honda/core/ecs";

export class SoundEmmiter implements IComponent {
    protected _isPlaying: boolean = false;
    protected _play: boolean = false;
    protected _loop: boolean = false

    constructor(
        public soundKey: string,
        public name: string = "SoundEmmiter",
        public volume: number = 1,
    ) {
        this.soundKey = soundKey;
        this.name = name;
        this.volume = volume;
    }

    public play() {
        this._play = true;
    }

    public stop() {
        this._play = false;
    }

    public setLoop(value: boolean) {
        this._loop = value;
    }

    public setPlaying(value: boolean) {
        this._isPlaying = value;
    }

    public isPlaying() {
        return this._isPlaying;
    }

    public shouldPlay() {
        return this._play;
    }

    public shouldLoop() {
        return this._loop;
    }
}