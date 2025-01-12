import { System, SceneNode, CameraSystem } from "@/honda";
import { SoundEmmiter } from "./sound-emitter.component";
import { Game } from "@/honda";
import { vec3 } from "wgpu-matrix";

export class SoundSystem extends System {
    public componentType = SoundEmmiter;

    protected audioContext: AudioContext;
    protected audioBuffers: Map<string, AudioBuffer> = new Map()

    protected components = new Map<SoundEmmiter, SceneNode>();
    
    protected activeSources: Map<string, AudioBufferSourceNode> = new Map();
    protected activeComponentSources: Map<SoundEmmiter, AudioBufferSourceNode> = new Map();
    protected activeComponentPanners: Map<SoundEmmiter, PannerNode> = new Map();
    constructor()
    {
        super();
        this.audioContext = new AudioContext();
    }

    public componentCreated(node: SceneNode, component: SoundEmmiter) {
        if (this.components.delete(component)) {
            console.warn("moved component to new node", component, node);
        }
        this.components.set(component, node);
    }

    public componentDestroyed(node: SceneNode, component: SoundEmmiter) {
        const source = this.activeComponentSources.get(component);
        if (source) {
            source.stop();
            this.activeComponentSources.delete(component);
        }

        this.components.delete(component);
    }
      

    public update(): void {
        const cameraSystem = Game.ecs.getSystem(CameraSystem);

        const node = cameraSystem.getActiveCameraNode();
        if (!node) {
            return;
        }

        const cameraTransform = node.transform;
        const position = cameraTransform.translation;

        const forward = vec3.fromValues(
            -cameraTransform.$glbMtx[8],
            -cameraTransform.$glbMtx[9],
            -cameraTransform.$glbMtx[10]
        );

        const up = vec3.fromValues(
            cameraTransform.$glbMtx[4],
            cameraTransform.$glbMtx[5],
            cameraTransform.$glbMtx[6]
        );

        this.audioContext.listener.positionX.value = position[0];
        this.audioContext.listener.positionY.value = position[1];
        this.audioContext.listener.positionZ.value = position[2];

        this.audioContext.listener.forwardX.value = forward[0];
        this.audioContext.listener.forwardY.value = forward[1];
        this.audioContext.listener.forwardZ.value = forward[2];

        this.audioContext.listener.upX.value = up[0];
        this.audioContext.listener.upY.value = up[1];
        this.audioContext.listener.upZ.value = up[2];


        this.components.keys().forEach((x) => {
            const node = this.components.get(x);
            if (!node) {
                return
            }

            const panner = this.activeComponentPanners.get(x);
            if (panner) {
                panner.positionX.value = node.transform.translation[0];
                panner.positionY.value = node.transform.translation[1];
                panner.positionZ.value = node.transform.translation[2];
            }

            if (x.shouldPlay() && !x.isPlaying()) {
                this.playComponentAudio(x);
            }

            if (!x.shouldPlay() && x.isPlaying()) {
                this.stopComponentAudio(x);
            }
        });

    }

    public async loadAudioFiles( audioFiles: { [key: string]: string } ) {
        for (const [key, url] of Object.entries(audioFiles)) {
            try {
                const buffer = await this.loadAudioBuffer(url);
                if (!buffer) {
                    continue;
                }
                this.audioBuffers.set(key, buffer);
            }
            catch (e) {
                console.warn(`Failed to load audio file: ${url}`);
            }
        }
    }

    private async loadAudioBuffer(url: string) {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to load audio file: ${url}`);
            return;
        }

        const arrayBuffer = await response.arrayBuffer();
        return this.audioContext.decodeAudioData(arrayBuffer);
    }

    public playAudio(
        audioKey: string,
        loop: boolean = false,
        volume: number = 1,
        audioId: string = ""
    ) {
        const buffer = this.audioBuffers.get(audioKey);
        if (!buffer) {
            console.warn(`Audio buffer not found: ${audioKey}`);
            return;
        }

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;

        const gain = this.audioContext.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(this.audioContext.destination);

        if (audioId !== "") {
            this.activeSources.set(audioId, source);
        }

        source.onended = () => {
            this.activeSources.delete(audioId);
        }

        source.start(0);
    }

    public stopAudio(audioId: string) {
        const source = this.activeSources.get(audioId);
        if (!source) {
            return;
        }

        source.stop();
        this.activeSources.delete(audioId);
    }

    protected playComponentAudio(component: SoundEmmiter) {        
        const buffer = this.audioBuffers.get(component.soundKey);
        if (!buffer) {
            console.warn(`Audio buffer not found: ${component.soundKey}`);
            return;
        }

        const node = this.components.get(component);
        if (!node) {
            console.warn(`Node not found for component: ${component}`);
            return;
        }

        component.setPlaying(true)

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = component.shouldLoop();

        this.activeComponentSources.set(component, source);

        source.onended = () => {
            component.setPlaying(false);
            component.stop();
            this.activeComponentSources.delete(component);
        }

        const panner = this.audioContext.createPanner();
        panner.positionX.value = node.transform.translation[0];
        panner.positionY.value = node.transform.translation[1];
        panner.positionZ.value = node.transform.translation[2];
        panner.coneInnerAngle = 360;
        panner.distanceModel = "inverse";
        panner.refDistance = 1;
        panner.rolloffFactor = 1;
        panner.maxDistance = 200;
        this.activeComponentPanners.set(component, panner);

        const gain = this.audioContext.createGain();
        gain.gain.value = component.volume;
        
        source.connect(panner).connect(gain).connect(this.audioContext.destination);

        source.start(0);
    }

    protected stopComponentAudio(component: SoundEmmiter) {
        const source = this.activeComponentSources.get(component);
        if (!source) {
            return;
        }

        source.stop();
        this.activeComponentSources.delete(component);
        this.activeComponentPanners.delete(component);
        component.setPlaying(false);
        component.stop();
    }

    public isPlaying(audioId: string) {
        return this.activeSources.has(audioId);
    }
}