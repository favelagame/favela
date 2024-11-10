import { Vec3 } from "wgpu-matrix";
import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";

import {
    TransformComponent,
    Game,
    Entity,
    System,
    CameraSystem,
} from "@/honda/core";
import code from "@/honda/shaders/basicMesh.wgsl?raw";

import { MeshComponent } from "./meshRenderer.component";
import * as cr from "./meshRenderer.constants";

const SHADER_DEFS = makeShaderDataDefinitions(code);

export class MeshRendererSystem extends System {
    public componentsRequired = new Set([TransformComponent, MeshComponent]);

    protected pipeline: GPURenderPipeline;
    protected module: GPUShaderModule;

    protected gUniforms = makeStructuredView(SHADER_DEFS.uniforms["uniforms"]);
    protected gUniformsBuffer: GPUBuffer;
    protected gUniformBindGroup: GPUBindGroup;

    protected iUniforms = makeStructuredView(SHADER_DEFS.uniforms["instance"]);
    protected iUniformsBuffer: GPUBuffer;
    protected iUniformBindGroup: GPUBindGroup;

    constructor(
        protected lightDirection: Vec3,
        public readonly maxInstances = 16384
    ) {
        super();

        this.module = Game.gpu.device.createShaderModule({
            code,
        });

        this.pipeline = Game.gpu.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: this.module,
                buffers: [
                    {
                        arrayStride: 12,
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: "float32x3",
                            },
                        ],
                    },
                    {
                        arrayStride: 12,
                        attributes: [
                            {
                                shaderLocation: 1,
                                offset: 0,
                                format: "float32x3",
                            },
                        ],
                    },
                    {
                        arrayStride: 8,
                        attributes: [
                            {
                                shaderLocation: 2,
                                offset: 0,
                                format: "float32x2",
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module: this.module,
                targets: [{ format: Game.gpu.pFormat }],
            },
            primitive: {
                topology: "triangle-list",
                cullMode: "back",
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus",
            },
        });

        this.gUniformsBuffer = Game.gpu.device.createBuffer({
            size: this.gUniforms.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        this.gUniformBindGroup = Game.gpu.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: cr.UNIFORM_BIND_GROUP_BINDING,
                    resource: { buffer: this.gUniformsBuffer },
                },
            ],
        });

        this.iUniformsBuffer = Game.gpu.device.createBuffer({
            size: this.iUniforms.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        this.iUniformBindGroup = Game.gpu.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [
                {
                    binding: cr.UNIFORM_BIND_GROUP_BINDING,
                    resource: { buffer: this.iUniformsBuffer },
                },
            ],
        });
    }

    public update(entities: Set<Entity>): void {
        const cs = this.ecs.getSystem(CameraSystem);
        this.gUniforms.set({
            viewProjection: cs.viewMatrix,
            sunDirection: this.lightDirection,
            deltaTime: Game.deltaTime,
            time: Game.time,
        });
        Game.gpu.device.queue.writeBuffer(
            this.gUniformsBuffer,
            0,
            this.gUniforms.arrayBuffer
        );

        cr.RENDER_PASS_DESCRIPTOR.colorAttachments[0].view =
            Game.gpu.canvasTextureView;
        cr.RENDER_PASS_DESCRIPTOR.depthStencilAttachment.view =
            Game.gpu.depthTextureView;

        //TODO: optimise this :sob:
        for (const entity of entities) {
            const comp = this.ecs.getComponents(entity);
            const tc = comp.get(TransformComponent);
            const mc = comp.get(MeshComponent);

            this.iUniforms.set({
                transform: tc.matrix,
                color: mc.color,
            });
            Game.gpu.device.queue.writeBuffer(
                this.iUniformsBuffer,
                0,
                this.iUniforms.arrayBuffer
            );

            const pass = Game.cmdEncoder.beginRenderPass(
                cr.RENDER_PASS_DESCRIPTOR
            );

            pass.setPipeline(this.pipeline);
            pass.setBindGroup(0, this.gUniformBindGroup);
            pass.setBindGroup(1, this.iUniformBindGroup);

            mc.mesh.attach(pass);
            pass.drawIndexed(mc.mesh.drawCount);
            pass.end();
            Game.gpu.pushQueue();
        }
    }
}
