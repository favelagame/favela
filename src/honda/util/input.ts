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
        document.addEventListener("pointerlockchange", () => {
            if (!document.pointerLockElement) {
                console.log("lost capture");
                this.pointerLocked = false;
            }
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
        this.btnMap[`mouse${ev.button}`] = false;
    }

    protected async lockPointer(unadjusted = true) {
        try {
            if (unadjusted) {
                await this.rootElement.requestPointerLock({
                    unadjustedMovement: true,
                });
            } else {
                await this.rootElement.requestPointerLock();
            }
            this.pointerLocked = true;
        } catch (ex) {
            if (unadjusted && ex instanceof DOMException) {
                console.warn(
                    "unadjustedMovement pointerLock failed, falling back"
                );
                this.lockPointer(false);
            } else console.error("Could not get pointer lock");
        }
    }

    protected async onMouseDown(ev: MouseEvent) {
        if (!this.pointerLocked) {
            this.lockPointer();
        }
        this.btnMap[`mouse${ev.button}`] = true;
    }

    protected onMouseMove(ev: MouseEvent) {
        if (this.pointerLocked) {
            this.mouseDeltaX += ev.movementX;
            this.mouseDeltaY += ev.movementY;
        }
    }
}
