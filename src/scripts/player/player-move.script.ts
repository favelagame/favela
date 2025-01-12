import { clamp, PI_2 } from "@/honda/util";
import {
    DynamicAABBColider,
    LAYER_PICKUP,
    LAYER_QUERY,
    Game,
    Script,
    SoundSystem,
    LightComponent,
    MeshComponent,
    SceneNode,
    CameraSystem,
    SoundEmmiter,
} from "@/honda";
import { vec3, quat } from "wgpu-matrix";

// basic deadzone
function dz(x: number) {
    return Math.abs(x) < 0.1 ? 0 : x;
}

const sens = 0.0009;
const sensGamepad = 0.05;

export class PlayerMoveScript extends Script {
    protected moveBaseVec = vec3.create(0, 0, 0);
    protected pitch = 0;
    protected yaw = 0;

    protected foot = false;
    protected elapsedFoot = 0;
    protected leftFootstepEmitter: SceneNode | null = null;
    protected rightFootstepEmitter: SceneNode | null = null;

    protected colider!: DynamicAABBColider;

    protected stamina = 100;
    protected maxStamina = 100;
    protected staminaDrainJump = 20;
    protected staminaDrainSprint = 10;
    protected staminaRegenRate = 15; // Stamina regenerated per second
    protected isJumping = false;
    protected isRunning = false;
    protected jumpForce = 80;
    protected jumpTime = 0;

    protected health = 100;
    protected maxHealth = 100;

    protected clipSize = 11;
    protected ammo = 11;
    protected extraAmmo = 23;
    protected shooting = false;
    protected reloadTime = 2;
    protected reloading = false;
    protected reloadProgress = 0;
    protected gunRecoilOffset = vec3.create(0, 0, 0);
    protected gunRecoilRotation = vec3.create(0, 0, 0);
    protected recoilRecoverySpeed = 10;
    protected maxRecoilPositionZ = -0.2;
    protected maxRecoilRotationX = 0.5;

    protected bobbingAmplitude = 0.01;
    protected bobbingFrequency = 6;
    protected bobbingOffset = 0;

    protected pistolNode: SceneNode | null = null;
    protected flashlightNode: SceneNode | null = null;

    public onAttach(): void {
        this.colider = this.node.assertComponent(DynamicAABBColider);
        this.colider.detectLayers |= LAYER_QUERY | LAYER_PICKUP;

        this.leftFootstepEmitter = new SceneNode();
        this.leftFootstepEmitter.name = "LeftFootstepEmitter";
        this.leftFootstepEmitter.transform.translation.set([0, -1, 0]);
        this.leftFootstepEmitter.addComponent(
            new SoundEmmiter("footstepL", "footstepL", 1)
        );
        this.node.addChild(this.leftFootstepEmitter);

        this.rightFootstepEmitter = new SceneNode();
        this.rightFootstepEmitter.name = "RightFootstepEmitter";
        this.rightFootstepEmitter.transform.translation.set([0, -1, 0]);
        this.rightFootstepEmitter.addComponent(
            new SoundEmmiter("footstepR", "footstepR", 1)
        );
        this.node.addChild(this.rightFootstepEmitter);
    }

    override update(): void {
        let boost = false;
        let jump = false;
        const g = Game.input.activeGamepad;

        if (g) {
            boost = g.buttons[0].pressed;
            this.moveBaseVec[0] = dz(g.axes[0]);
            this.moveBaseVec[1] = 0;
            this.moveBaseVec[2] = dz(g.axes[1]);

            this.pitch = clamp(
                -PI_2,
                this.pitch + dz(g.axes[3]) * -sensGamepad,
                PI_2
            );
            this.yaw += dz(g.axes[2]) * -sensGamepad;
            quat.fromEuler(
                this.pitch,
                this.yaw,
                0,
                "yxz",
                this.node.transform.rotation
            );
        } else {
            boost = Game.input.btnMap["ShiftLeft"];
            this.moveBaseVec[0] =
                (Game.input.btnMap["KeyD"] ? 1 : 0) +
                (Game.input.btnMap["KeyA"] ? -1 : 0);
            this.moveBaseVec[1] = 0;
            this.moveBaseVec[2] =
                (Game.input.btnMap["KeyW"] ? -1 : 0) +
                (Game.input.btnMap["KeyS"] ? 1 : 0);

            jump = Game.input.btnMap["Space"];

            if (Game.input.btnMap["mouse0"] && this.pistolNode && !this.shooting && !this.reloading) {
                this.shooting = true;
                this.fire();
            }

            if (!Game.input.btnMap["mouse0"]) {
                this.shooting = false;
            }

            if (Game.input.btnMap["KeyR"] && this.pistolNode && this.ammo < this.clipSize && this.extraAmmo > 0 && !this.reloading) {
                this.reloading = true;
                Game.ecs.getSystem(SoundSystem).playAudio("reload", false, 0.5);
            }

            if (this.reloading) {
                this.reloadProgress += Game.deltaTime;
                if (this.reloadProgress >= this.reloadTime) {
                    this.reload();
                }
            }

            this.pitch = clamp(
                -PI_2,
                this.pitch + Game.input.mouseDeltaY * -sens,
                PI_2
            );
            this.yaw += Game.input.mouseDeltaX * -sens;
            quat.fromEuler(
                this.pitch,
                this.yaw,
                0,
                "yxz",
                this.node.transform.rotation
            );
        }

        // Movement Logic
        const moveVec = vec3.create();
        vec3.transformQuat(
            this.moveBaseVec,
            this.node.transform.rotation,
            moveVec
        );
        vec3.normalize(moveVec, moveVec);

        const speedMultiplier = boost && this.stamina > 0 ? 25 : 15;
        if (boost && this.stamina > 0) {
            this.stamina -= this.staminaDrainSprint * Game.deltaTime;
            this.isRunning = true;
        }
        else {
            this.isRunning = false;
        }

        moveVec[0] *= speedMultiplier;
        moveVec[2] *= speedMultiplier;

        this.colider.forces[0] += moveVec[0];
        this.colider.forces[2] += moveVec[2];

        // Jumping Logic
        if (
            jump &&
            !this.isJumping &&
            this.colider.onFloor &&
            this.stamina >= this.staminaDrainJump
        ) {
            this.isJumping = true;
            this.stamina -= this.staminaDrainJump;
        }

        if (this.isJumping && this.jumpTime < 0.1) {
            this.colider.forces[1] += this.jumpForce;
            this.jumpTime += Game.deltaTime;
        }

        if (!jump && this.colider.onFloor) {
            this.isJumping = false;
            this.jumpTime = 0;
        }

        // Recoil Logic
        if (this.pistolNode) {
            // Smoothly recover position and rotation using vec3 lerp
            vec3.lerp(
                this.gunRecoilOffset,
                [0, 0, 0],
                this.recoilRecoverySpeed * Game.deltaTime,
                this.gunRecoilOffset
            );
            vec3.lerp(
                this.gunRecoilRotation,
                [0, 0, 0],
                this.recoilRecoverySpeed * Game.deltaTime,
                this.gunRecoilRotation
            );

            quat.fromEuler(
                this.gunRecoilRotation[0],
                0,
                0,
                "xyz",
                this.pistolNode.transform.rotation
            );

            this.pistolNode.transform.update();
            
        }

        // Camera Bobbing
        const cameraNode = Game.ecs.getSystem(CameraSystem).getActiveCameraNode();
        if (cameraNode) {
            if ((this.colider.forces[0] !== 0 || this.colider.forces[2] !== 0) && this.colider.onFloor) {
                this.bobbingOffset += Game.deltaTime * (this.isRunning ? 2 : 1) * this.bobbingFrequency;
                const bobbingY = Math.sin(this.bobbingOffset) * this.bobbingAmplitude;
                cameraNode.transform.translation[1] = bobbingY;
                const bobbingZ = Math.cos(this.bobbingOffset) * this.bobbingAmplitude;
                cameraNode.transform.translation[2] = bobbingZ;
            } else {
                this.bobbingOffset = 0;
                cameraNode.transform.translation[1] = 0;
                cameraNode.transform.translation[2] = 0;
            }
            cameraNode.transform.update();
        }


        // Footstep Sounds
        const left = this.leftFootstepEmitter!.assertComponent(SoundEmmiter);
        const right = this.rightFootstepEmitter!.assertComponent(SoundEmmiter);
        if ((this.colider.forces[0] !== 0 || this.colider.forces[2] !== 0) && this.colider.onFloor) {
            if (this.elapsedFoot > (this.isRunning ? 0.2 : 0.4)) {
                if (this.foot) {
                    if (
                        !right.isPlaying()
                    ) {
                        right.play();
                    }
                } else {
                    if (
                        !left.isPlaying()
                    ) {
                        left.play();
                    }
                }
                this.foot = !this.foot;
                this.elapsedFoot = 0;
            }
        } else {
            left.stop();
            right.stop();
        }

        // DOM
        const staminaCounter = document.getElementById("stamina");
        const healthCounter = document.getElementById("health");
        const clipAmmoCounter = document.getElementById("clipAmmo");
        const ammoCounter = document.getElementById("extraAmmo");



        if (staminaCounter) {
            staminaCounter.innerText = `${Math.max(0, Math.floor(this.stamina))}`;
        }

        if (healthCounter) {
            healthCounter.innerText = `${Math.max(0, Math.floor(this.health))}`;
        }

        if (clipAmmoCounter) {
            clipAmmoCounter.innerText = `${this.pistolNode ? Math.max(0, Math.floor(this.ammo)) : 0}`;
        }

        if (ammoCounter) {
            ammoCounter.innerText = `${this.pistolNode ? Math.max(0, Math.floor(this.extraAmmo)) : 0}`;
        }

        this.elapsedFoot += Game.deltaTime;

        // Stamina Regeneration
        if (!boost && !jump) {
            this.stamina = Math.min(
                this.stamina + this.staminaRegenRate * Game.deltaTime,
                this.maxStamina
            );
        }
    }

    override lateUpdate(): void {
        for (const [, ci] of this.colider.collisions) {
            if (ci.colider.onLayers & LAYER_PICKUP) {
                Game.ecs.getSystem(SoundSystem).playAudio("pickup", false, 1);

                console.log("Picked up", ci.node.name);
                switch (ci.node.name) {
                    case "PickupLight": {
                        this.flashlightNode = new SceneNode();
                        this.flashlightNode.name = "PlayerLight";
                        this.flashlightNode.transform.translation.set([
                            -0.13, -0.15, -0.2,
                        ]);
                        quat.fromEuler(
                            -Math.PI / 2 + 0.2,
                            0,
                            -0.15,
                            "xyz",
                            this.flashlightNode.transform.rotation
                        );
                        this.flashlightNode.transform.scale.set([0.025, 0.025, 0.025]);
                        this.flashlightNode.transform.update();
                        const lightMesh =
                            ci.node.assertComponent(MeshComponent);
                        ci.node.removeComponent(lightMesh);
                        this.flashlightNode.addComponent(lightMesh);

                        this.node.addChild(this.flashlightNode);

                        this.node.assertChildComponent(
                            LightComponent //magneti
                        ).lightInfo.intensity = 300; // zlt bom ceu

                        break;
                    }

                    case "PickupPistol": {
                        this.pistolNode = new SceneNode();
                        this.pistolNode.name = "PlayerPistol";
                        this.pistolNode.transform.translation.set([
                            0.2, -0.2, -0.25,
                        ]);
                        quat.fromEuler(
                            0,
                            0,
                            -0,
                            "xyz",
                            this.pistolNode.transform.rotation
                        );
                        this.pistolNode.transform.scale.set([0.025, 0.025, 0.025]);
                        this.pistolNode.transform.update();
                        const pistolMesh =
                            ci.node.assertComponent(MeshComponent);
                        ci.node.removeComponent(pistolMesh);
                        this.pistolNode.addComponent(pistolMesh);
                        this.node.addChild(this.pistolNode);

                        break;
                    }
                }
                ci.node.parent?.removeChild(ci.node);
            }
        }
    }

    public fire(): void {
        if (this.ammo > 0) {
            Game.ecs.getSystem(SoundSystem).playAudio("gunShot", false, 0.1);
            this.ammo--;

            this.gunRecoilOffset[2] = this.maxRecoilPositionZ;
            this.gunRecoilRotation[0] = this.maxRecoilRotationX;
        }
        else {
            Game.ecs.getSystem(SoundSystem).playAudio("gunClick", false, 0.2);
        }
    }

    public reload(): void {
        this.reloadProgress = 0;
        this.reloading = false;
        const ammoNeeded = this.clipSize - this.ammo;
        this.ammo += Math.min(ammoNeeded, this.extraAmmo);
        this.extraAmmo -= Math.min(ammoNeeded, this.extraAmmo);
    }
}
