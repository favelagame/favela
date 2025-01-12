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
    PhysicsSystem,
    LAYER_PHYSICS,
    LAYER_ENEMY,
    ScriptComponent,
} from "@/honda";
import { vec3, quat } from "wgpu-matrix";
import { EnemyScript } from "./enemy.script";

// basic deadzone
function dz(x: number) {
    return Math.abs(x) < 0.1 ? 0 : x;
}

const sens = 0.0009;
const sensGamepad = 0.05;

export class PlayerScript extends Script {
    protected _moveBaseVec = vec3.create(0, 0, 0);
    protected _pitch = 0;
    protected _yaw = 0;

    protected _foot = false;
    protected _elapsedFoot = 0;
    protected _leftFootstepEmitter: SceneNode | null = null;
    protected _rightFootstepEmitter: SceneNode | null = null;

    protected _colider!: DynamicAABBColider;

    protected _stamina = 100;
    protected _maxStamina = 100;
    protected _staminaDrainJump = 20;
    protected _staminaDrainSprint = 20;
    protected _staminaRegenRate = 15; // Stamina regenerated per second
    protected _isJumping = false;
    protected _isRunning = false;
    protected _jumpForce = 80;
    protected _jumpTime = 0;

    protected _health = 100;
    protected _maxHealth = 100;

    protected _clipSize = 11;
    protected _ammo = 11;
    protected _extraAmmo = 23;
    protected _shooting = false;
    protected _reloadTime = 2;
    protected _reloading = false;
    protected _reloadProgress = 0;
    protected _gunRecoilOffset = vec3.create(0, 0, 0);
    protected _gunRecoilRotation = vec3.create(0, 0, 0);
    protected _recoilRecoverySpeed = 10;
    protected _maxRecoilPositionZ = -0.2;
    protected _maxRecoilRotationX = 0.5;
    protected _flashDecayFactor = 1333;

    protected _bobbingAmplitude = 0.01;
    protected _bobbingFrequency = 6;
    protected _bobbingOffset = 0;

    protected _pistolNode: SceneNode | null = null;
    protected _flashlightNode: SceneNode | null = null;

    public onAttach(): void {
        this._colider = this.node.assertComponent(DynamicAABBColider);
        this._colider.detectLayers |= LAYER_QUERY | LAYER_PICKUP;

        this._leftFootstepEmitter = new SceneNode();
        this._leftFootstepEmitter.name = "LeftFootstepEmitter";
        this._leftFootstepEmitter.transform.translation.set([0, -1, 0]);
        this._leftFootstepEmitter.addComponent(
            new SoundEmmiter("footstepL", "footstepL", 1)
        );
        this.node.addChild(this._leftFootstepEmitter);

        this._rightFootstepEmitter = new SceneNode();
        this._rightFootstepEmitter.name = "RightFootstepEmitter";
        this._rightFootstepEmitter.transform.translation.set([0, -1, 0]);
        this._rightFootstepEmitter.addComponent(
            new SoundEmmiter("footstepR", "footstepR", 1)
        );
        this.node.addChild(this._rightFootstepEmitter);
    }

    override update(): void {
        let boost = false;
        let jump = false;
        const g = Game.input.activeGamepad;

        if (g) {
            boost = g.buttons[0].pressed;
            this._moveBaseVec[0] = dz(g.axes[0]);
            this._moveBaseVec[1] = 0;
            this._moveBaseVec[2] = dz(g.axes[1]);

            this._pitch = clamp(
                -PI_2,
                this._pitch + dz(g.axes[3]) * -sensGamepad,
                PI_2
            );
            this._yaw += dz(g.axes[2]) * -sensGamepad;
            quat.fromEuler(
                this._pitch,
                this._yaw,
                0,
                "yxz",
                this.node.transform.rotation
            );
        } else {
            boost = Game.input.btnMap["ShiftLeft"];
            this._moveBaseVec[0] =
                (Game.input.btnMap["KeyD"] ? 1 : 0) +
                (Game.input.btnMap["KeyA"] ? -1 : 0);
            this._moveBaseVec[1] = 0;
            this._moveBaseVec[2] =
                (Game.input.btnMap["KeyW"] ? -1 : 0) +
                (Game.input.btnMap["KeyS"] ? 1 : 0);

            jump = Game.input.btnMap["Space"];

            if (this._pistolNode && this._pistolNode.assertChildComponent(LightComponent).lightInfo.intensity > 0) {
                this._pistolNode.assertChildComponent(LightComponent).lightInfo.intensity -= Game.deltaTime * this._flashDecayFactor;
            }

            if (Game.input.btnMap["mouse0"] && this._pistolNode && !this._shooting && !this._reloading) {
                this._shooting = true; // uncomment to enable auto fire
                this.fire();
            }

            if (!Game.input.btnMap["mouse0"]) {
                this._shooting = false;
            }

            if (Game.input.btnMap["KeyR"] && this._pistolNode && this._ammo < this._clipSize && this._extraAmmo > 0 && !this._reloading) {
                this._reloading = true;
                Game.ecs.getSystem(SoundSystem).playAudio("reload", false, 0.5);
            }

            if (this._reloading) {
                this._reloadProgress += Game.deltaTime;
                if (this._reloadProgress >= this._reloadTime) {
                    this.reload();
                }
            }

            this._pitch = clamp(
                -PI_2,
                this._pitch + Game.input.mouseDeltaY * -sens,
                PI_2
            );
            this._yaw += Game.input.mouseDeltaX * -sens;
            quat.fromEuler(
                this._pitch,
                this._yaw,
                0,
                "yxz",
                this.node.transform.rotation
            );
        }

        // Movement Logic
        const moveVec = vec3.create();
        vec3.transformQuat(
            this._moveBaseVec,
            this.node.transform.rotation,
            moveVec
        );
        vec3.normalize(moveVec, moveVec);

        const speedMultiplier = boost && this._stamina > 0 ? 360 : 280;
        if (boost && this._stamina > 0) {
            this._stamina -= this._staminaDrainSprint * Game.deltaTime;
            this._isRunning = true;

            if (this._stamina <= 0) {
                if (!Game.ecs.getSystem(SoundSystem).isPlaying("breathe")) {
                    Game.ecs.getSystem(SoundSystem).playAudio("breathe", false, 1, "breathe");
                }
            }
        }
        else {
            this._isRunning = false;
        }

        moveVec[0] *= speedMultiplier * Game.deltaTime;
        moveVec[2] *= speedMultiplier * Game.deltaTime;

        this._colider.forces[0] += moveVec[0];
        this._colider.forces[2] += moveVec[2];

        // Jumping Logic
        if (
            jump &&
            !this._isJumping &&
            this._colider.onFloor &&
            this._stamina >= this._staminaDrainJump
        ) {
            this._isJumping = true;
            this._stamina -= this._staminaDrainJump;
        }

        if (this._isJumping && this._jumpTime < 0.1) {
            this._colider.forces[1] += this._jumpForce;
            this._jumpTime += Game.deltaTime;
        }

        if (!jump && this._colider.onFloor) {
            this._isJumping = false;
            this._jumpTime = 0;
        }

        // Recoil Logic
        if (this._pistolNode) {
            // Smoothly recover position and rotation using vec3 lerp
            vec3.lerp(
                this._gunRecoilOffset,
                [0, 0, 0],
                this._recoilRecoverySpeed * Game.deltaTime,
                this._gunRecoilOffset
            );
            vec3.lerp(
                this._gunRecoilRotation,
                [0, 0, 0],
                this._recoilRecoverySpeed * Game.deltaTime,
                this._gunRecoilRotation
            );

            quat.fromEuler(
                this._gunRecoilRotation[0],
                0,
                0,
                "xyz",
                this._pistolNode.transform.rotation
            );

            this._pistolNode.transform.update();
            
        }

        // Camera Bobbing
        const cameraNode = Game.ecs.getSystem(CameraSystem).getActiveCameraNode();
        if (cameraNode) {
            if ((this._colider.forces[0] !== 0 || this._colider.forces[2] !== 0) && this._colider.onFloor) {
                this._bobbingOffset += Game.deltaTime * (this._isRunning ? 2 : 1) * this._bobbingFrequency;
                const bobbingY = Math.sin(this._bobbingOffset) * this._bobbingAmplitude;
                cameraNode.transform.translation[1] = bobbingY;
                const bobbingZ = Math.cos(this._bobbingOffset) * this._bobbingAmplitude;
                cameraNode.transform.translation[2] = bobbingZ;
            } else {
                this._bobbingOffset = 0;
                cameraNode.transform.translation[1] = 0;
                cameraNode.transform.translation[2] = 0;
            }
            cameraNode.transform.update();
        }


        // Footstep Sounds
        const left = this._leftFootstepEmitter!.assertComponent(SoundEmmiter);
        const right = this._rightFootstepEmitter!.assertComponent(SoundEmmiter);
        if ((this._colider.forces[0] !== 0 || this._colider.forces[2] !== 0) && this._colider.onFloor) {
            if (this._elapsedFoot > (this._isRunning ? 0.2 : 0.4)) {
                if (this._foot) {
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
                this._foot = !this._foot;
                this._elapsedFoot = 0;
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
            staminaCounter.innerText = `${Math.max(0, Math.floor(this._stamina))}`;
        }

        if (healthCounter) {
            healthCounter.innerText = `${Math.max(0, Math.floor(this._health))}`;
        }

        if (clipAmmoCounter) {
            clipAmmoCounter.innerText = `${this._pistolNode ? Math.max(0, Math.floor(this._ammo)) : 0}`;
        }

        if (ammoCounter) {
            ammoCounter.innerText = `${this._pistolNode ? Math.max(0, Math.floor(this._extraAmmo)) : 0}`;
        }

        this._elapsedFoot += Game.deltaTime;

        // Stamina Regeneration
        if (!boost && !jump) {
            this._stamina = Math.min(
                this._stamina + this._staminaRegenRate * Game.deltaTime,
                this._maxStamina
            );
        }
    }

    override lateUpdate(): void {
        for (const [, ci] of this._colider.collisions) {
            if (ci.colider.onLayers & LAYER_PICKUP) {
                Game.ecs.getSystem(SoundSystem).playAudio("pickup", false, 1);

                console.log("Picked up", ci.node.name);
                switch (ci.node.name) {
                    case "PickupLight": {
                        this._flashlightNode = new SceneNode();
                        this._flashlightNode.name = "PlayerLight";
                        this._flashlightNode.transform.translation.set([
                            -0.13, -0.15, -0.2,
                        ]);
                        quat.fromEuler(
                            -Math.PI / 2 + 0.2,
                            0,
                            -0.15,
                            "xyz",
                            this._flashlightNode.transform.rotation
                        );
                        this._flashlightNode.transform.scale.set([0.025, 0.025, 0.025]);
                        this._flashlightNode.transform.update();
                        const lightMesh =
                            ci.node.assertComponent(MeshComponent);
                        ci.node.removeComponent(lightMesh);
                        this._flashlightNode.addComponent(lightMesh);

                        this.node.addChild(this._flashlightNode);

                        this.node.assertChildComponent(
                            LightComponent //magneti
                        ).lightInfo.intensity = 300; // zlt bom ceu

                        break;
                    }

                    case "PickupPistol": {
                        this._pistolNode = new SceneNode();
                        this._pistolNode.name = "PlayerPistol";
                        this._pistolNode.transform.translation.set([
                            0.2, -0.2, -0.25,
                        ]);
                        quat.fromEuler(
                            0,
                            0,
                            -0,
                            "xyz",
                            this._pistolNode.transform.rotation
                        );
                        this._pistolNode.transform.scale.set([0.025, 0.025, 0.025]);
                        this._pistolNode.transform.update();
                        const pistolMesh =
                            ci.node.assertComponent(MeshComponent);
                        ci.node.removeComponent(pistolMesh);
                        this._pistolNode.addComponent(pistolMesh);
                        this.node.addChild(this._pistolNode);

                        const pistolFlash = new SceneNode();
                        pistolFlash.name = "PistolFlash";
                        pistolFlash.transform.translation.set([0, 3, -11]);
                        pistolFlash.transform.update();
                        pistolFlash.addComponent(
                            new LightComponent({
                                castShadows: false,
                                color: [1, 0.333, 0],
                                type: "point",
                                intensity: 0,
                                maxRange: 10,
                            })
                        );
                        this._pistolNode.addChild(pistolFlash);

                        break;
                    }
                }
                ci.node.parent?.removeChild(ci.node);
            }
        }
    }

    public fire(): void {
        if (this._ammo > 0) {
            Game.ecs.getSystem(SoundSystem).playAudio("gunShot", false, 0.1);
            this._pistolNode!.assertChildComponent(LightComponent).lightInfo.intensity = 50;
            this._ammo--;

            this._gunRecoilOffset[2] = this._maxRecoilPositionZ;
            this._gunRecoilRotation[0] = this._maxRecoilRotationX;
            
            const from = Game.ecs.getSystem(CameraSystem).getActiveCameraNode()!.transform.translation;
            const forward = vec3.create(0, 0, -1);
            vec3.transformQuat(forward, this.node.transform.rotation, forward);
            vec3.normalize(forward, forward);

            const hits = Game.ecs.getSystem(PhysicsSystem).raycast(from, forward, LAYER_PHYSICS | LAYER_ENEMY);


            console.log(hits)

            if (hits.length > 0) {
                const hit = hits[0];
                if (hit.node.name === "EnemyScript") {
                    const enemy = hit.node.parent!.assertComponent(ScriptComponent).script as EnemyScript;
                    enemy.damage(10);
                }
            }
        }
        else {
            Game.ecs.getSystem(SoundSystem).playAudio("gunClick", false, 0.2);
        }
    }

    public reload(): void {
        this._reloadProgress = 0;
        this._reloading = false;
        const ammoNeeded = this._clipSize - this._ammo;
        this._ammo += Math.min(ammoNeeded, this._extraAmmo);
        this._extraAmmo -= Math.min(ammoNeeded, this._extraAmmo);
    }
}
