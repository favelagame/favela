//TODO: Make a game-specific input system (aimX, aimY, moveX, moveY, fire, ...)
//TODO: |-Allow switch between mouse/controller

export class Input {
    public btnMap: Record<string, boolean> = {};
    public mouseDeltaX = 0;
    public mouseDeltaY = 0;
    public activeGamepad?: Gamepad;

    protected pointerLocked = false;

    public constructor(protected rootElement: HTMLCanvasElement) {
        window.addEventListener("keydown", (ev) => this.onKeyDown(ev));
        window.addEventListener("keyup", (ev) => this.onKeyUp(ev));
        rootElement.addEventListener("mousedown", (ev) => this.onMouseDown(ev));
        rootElement.addEventListener("mouseup", (ev) => this.onMouseUp(ev));
        rootElement.addEventListener("mousemove", (ev) => this.onMouseMove(ev));
        rootElement.addEventListener("lostpointercapture", () => {
            this.pointerLocked = false;
        });
    }

    public frame() {
        // find the gamepad with the most recent input
        let latest = 0;
        this.activeGamepad = undefined as Gamepad | undefined;
        navigator.getGamepads().forEach((x) => {
            if (x && x.timestamp > latest) {
                this.activeGamepad = x;
                latest = x.timestamp;
            }
        });
    }

    public endFrame() {
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;
    }

    protected onKeyDown(ev: KeyboardEvent) {
        this.btnMap[ev.code] = true;
    }

    protected onKeyUp(ev: KeyboardEvent) {
        this.btnMap[ev.code] = false;
    }

    protected onMouseUp(ev: MouseEvent) {
        this.btnMap[`mouse${ev.button}`] = true;
    }

    protected async onMouseDown(ev: MouseEvent) {
        if (!this.pointerLocked) {
            try {
                await this.rootElement.requestPointerLock({
                    unadjustedMovement: true,
                });
                this.pointerLocked = true;
            } catch (ex) {
                console.error("Could not get pointer lock", ex);
            }
        }
        this.btnMap[`mouse${ev.button}`] = false;
    }

    protected onMouseMove(ev: MouseEvent) {
        this.mouseDeltaX += ev.movementX;
        this.mouseDeltaY += ev.movementY;
    }
}