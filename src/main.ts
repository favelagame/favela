import { WebGpu } from "./honda/gpu";
import { ECS, Game, CTransform } from "./honda/core";
import {
    CCubeRenderer,
    CubeRendererSystem,
} from "./honda/systems/cubeRenderer";
import { mat4, vec3 } from "wgpu-matrix";

Game.gpu = await WebGpu.obtainForCanvas(document.querySelector("canvas")!);
const aspect = Game.gpu.canvas.width / Game.gpu.canvas.height;

function getProjectionMatrix(
    aspectRatio: number,
    fovY: number,
    near: number,
    far: number
) {
    // Perspective projection matrix
    const proj = mat4.perspective(fovY, aspectRatio, near, far);

    // Camera position and target
    const eye = vec3.create(3, 3, 3);
    const target = vec3.create(0, 0, 0);
    const up = vec3.create(0, 1, 0);

    // View matrix (camera transformation)
    const view = mat4.lookAt(eye, target, up);

    // Return combined view-projection matrix
    return mat4.multiply(proj, view);
}

const ecs = new ECS();
ecs.addSystem(
    new CubeRendererSystem(
        getProjectionMatrix(aspect, (2 * Math.PI) / 5, 0.01, 100),
        vec3.normalize(vec3.create(1, 2, 3))
    )
);

{
    const cube = ecs.addEntity();
    ecs.addComponent(cube, new CTransform());
    ecs.addComponent(cube, new CCubeRenderer(1, 0, 0.5));
}

{
    const cube2 = ecs.addEntity();
    const ct = new CTransform();
    ct.translation.set([0.3, -0.5, 1]);
    ct.updateMatrix();
    ecs.addComponent(cube2, ct);
    ecs.addComponent(cube2, new CCubeRenderer(0, 1, 0.5));
}

function frame(t: number) {
    Game.deltaTime = t - Game.time;
    Game.time = t;
    Game.cmdEncoder = Game.gpu.device.createCommandEncoder();

    const pass = Game.cmdEncoder.beginRenderPass({
        label: "clear",
        depthStencilAttachment: {
            view: Game.gpu.depthTexture.createView(), // FIXME(mbabnik) This "leaks" resources? (they get GCd tho afaik)
            depthLoadOp: "clear",
            depthStoreOp: "store",
            depthClearValue: 1,
        },
        colorAttachments: [
            {
                view: Game.gpu.ctx.getCurrentTexture().createView(),
                loadOp: "clear",
                storeOp: "store",
                clearValue: [0.8, 0.8, 1, 1],
            },
        ],
    });
    pass.end();

    ecs.update();

    Game.gpu.device.queue.submit([Game.cmdEncoder.finish()]);
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
Game.time = performance.now(); //get inital timestamp so delta isnt broken
