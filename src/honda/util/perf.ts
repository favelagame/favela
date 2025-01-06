import { Game } from "../state";

export class Perf {
    protected static readonly N = 100;

    protected frameStart = 0;
    protected frameIndex = 0;
    protected frameTimes = [...Array(Perf.N)].map(() => 0);
    protected frameToFrameTimes = [...Array(Perf.N)].map(() => 0);

    protected activeLabel: string | undefined;
    protected labelTimes = {} as Record<string, number>;
    protected labelStart = 0;

    protected gpuAccumulator = new Map<string, number>();
    protected gpuFrameCount = 0;

    constructor() {}

    public startFrame() {
        this.frameToFrameTimes[this.frameIndex] =
            performance.now() - this.frameStart;

        this.frameStart = performance.now();
        this.activeLabel = undefined;
    }

    public stopFrame() {
        if (this.activeLabel) this.measureEnd();
        this.frameTimes[this.frameIndex++] =
            performance.now() - this.frameStart;
        if (this.frameIndex == Perf.N) this.frameIndex = 0;
    }

    public measure(label: string) {
        if (this.activeLabel) this.measureEnd();

        this.activeLabel = label;
        this.labelStart = performance.now();
    }

    public measureEnd() {
        const l = this.activeLabel;
        if (!l) return;
        const t = performance.now() - this.labelStart;
        this.labelTimes[l] = (this.labelTimes[l] ?? 0) + t;
    }

    public get frametime() {
        return this.frameTimes.reduce((c, p) => c + p) / Perf.N;
    }

    public get fps() {
        const f =
            1000 / (this.frameToFrameTimes.reduce((c, p) => c + p) / Perf.N);

        return isNaN(f) ? 0 : f;
    }

    /**
     * collects all measured times, grouped by label (and clears them)
     * @returns
     */
    public measured() {
        const ts = Object.entries(this.labelTimes).sort((a, b) => b[1] - a[1]);
        for (const key in this.labelTimes) {
            this.labelTimes[key] = 0;
        }

        return ts;
    }

    public sumbitGpuTimestamps(
        labels: Record<number, string>,
        timestamps: BigInt64Array,
        n: number
    ) {
        for (let i = 0; i < n; i++) {
            const c = this.gpuAccumulator.get(labels[i]) ?? 0;
            this.gpuAccumulator.set(
                labels[i],
                c + Number(timestamps[2 * i + 1] - timestamps[2 * i])
            );
        }
        this.gpuFrameCount++;
    }

    public getGpuStats() {
        const stats = Array.from(this.gpuAccumulator.entries()).map(
            ([label, time]) =>
                [label, time / this.gpuFrameCount] as [string, number]
        );

        this.gpuAccumulator.clear();
        this.gpuFrameCount = 0;
        return stats.sort((a, b) => b[1] - a[1]);
    }
}

export function perfRenderer(
    fps: HTMLSpanElement,
    mspf: HTMLSpanElement,
    ents: HTMLSpanElement,
    cpu: HTMLPreElement,
    gpu: HTMLPreElement
) {
    return () => {
        fps.innerText = Game.perf.fps.toFixed(1).padStart(5, " ");
        mspf.innerText = Game.perf.frametime.toFixed(2).padStart(6, " ");
        ents.innerText = (Game.ecs?.entityCount ?? -1)
            .toString()
            .padStart(4, " ");

        const m = Game.perf.measured();
        cpu.innerText = m
            .map(([n, t]) => `${n.padEnd(32)}${t.toFixed(2).padStart(6, " ")}`)
            .join("\n");

        const g = Game.perf.getGpuStats();
        gpu.innerText = g
            .map(
                ([n, t]) =>
                    `${n.padEnd(30)} ${(t / 1000)
                        .toFixed(0)
                        .padStart(6, " ")}us`
            )
            .join("\n");
    };
}
