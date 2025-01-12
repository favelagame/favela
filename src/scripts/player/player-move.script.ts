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

    protected pistol = false;
    protected clipSize = 11;
    protected ammo = 111111;
    protected extraAmmo = 11;
    protected shooting = false;


    public onAttach(): void {
        this.colider = this.node.assertComponent(DynamicAABBColider);
        this.colider.detectLayers |= LAYER_QUERY | LAYER_PICKUP;
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

            if (Game.input.btnMap["mouse0"] && this.pistol && !this.shooting) {
                this.shooting = true;
                this.fire();
            }

            if (!Game.input.btnMap["mouse0"]) {
                this.shooting = false;
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

        // Footstep Sounds
        if ((this.colider.forces[0] !== 0 || this.colider.forces[2] !== 0) && this.colider.onFloor) {
            if (this.elapsedFoot > (this.isRunning ? 0.2 : 0.4)) {
                if (this.foot) {
                    if (
                        !Game.ecs.getSystem(SoundSystem).isPlaying("footstepR")
                    ) {
                        Game.ecs
                            .getSystem(SoundSystem)
                            .playAudio("footstepR", false, 1, "footstepR");
                    }
                } else {
                    if (
                        !Game.ecs.getSystem(SoundSystem).isPlaying("footstepL")
                    ) {
                        Game.ecs
                            .getSystem(SoundSystem)
                            .playAudio("footstepL", false, 1, "footstepL");
                    }
                }
                this.foot = !this.foot;
                this.elapsedFoot = 0;
            }
        } else {
            Game.ecs.getSystem(SoundSystem).stopAudio("footstepR");
            Game.ecs.getSystem(SoundSystem).stopAudio("footstepL");
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
            clipAmmoCounter.innerText = `${Math.max(0, Math.floor(this.ammo))}`;
        }

        if (ammoCounter) {
            ammoCounter.innerText = `${Math.max(0, Math.floor(this.extraAmmo))}`;
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
                        const lightNode = new SceneNode();
                        lightNode.name = "PlayerLight";
                        lightNode.transform.translation.set([
                            -0.13, -0.15, -0.2,
                        ]);
                        quat.fromEuler(
                            -Math.PI / 2 + 0.2,
                            0,
                            -0.15,
                            "xyz",
                            lightNode.transform.rotation
                        );
                        lightNode.transform.scale.set([0.025, 0.025, 0.025]);
                        lightNode.transform.update();
                        const lightMesh =
                            ci.node.assertComponent(MeshComponent);
                        ci.node.removeComponent(lightMesh);
                        lightNode.addComponent(lightMesh);

                        this.node.addChild(lightNode);

                        this.node.assertChildComponent(
                            LightComponent //magneti
                        ).lightInfo.intensity = 300; // zlt bom ceu

                        break;
                    }

                    case "PickupPistol": {
                        const pistolNode = new SceneNode();
                        pistolNode.name = "PlayerPistol";
                        pistolNode.transform.translation.set([
                            0.2, -0.2, -0.25,
                        ]);
                        quat.fromEuler(
                            0,
                            0,
                            -0,
                            "xyz",
                            pistolNode.transform.rotation
                        );
                        pistolNode.transform.scale.set([0.025, 0.025, 0.025]);
                        pistolNode.transform.update();
                        const pistolMesh =
                            ci.node.assertComponent(MeshComponent);
                        ci.node.removeComponent(pistolMesh);
                        pistolNode.addComponent(pistolMesh);
                        this.node.addChild(pistolNode);

                        this.pistol = true;

                        break;
                    }
                }
                ci.node.parent?.removeChild(ci.node);
            }
        }
    }

    public fire(): void {
        if (this.ammo > 0) {
            Game.ecs.getSystem(SoundSystem).playAudio("gunShot", false, 0.2);
            this.ammo--;
        }
        else {
            Game.ecs.getSystem(SoundSystem).playAudio("gunClick", false, 0.3);
        }
    }
}
