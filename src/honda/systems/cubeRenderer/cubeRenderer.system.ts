import { Vec3 } from "wgpu-matrix";

import { Game } from "@/honda/state";
import { TransformComponent } from "@/honda/systems/transform";
import { Entity, System } from "@/honda/ecs";

import { CubeComponent } from "./cubeRenderer.component";
import { CUBE_VERTEX_COUNT, CUBE_VERTEX_DATA } from "./cube.constants";

import code from "@/honda/shaders/basicMesh.wgsl?raw";
import * as cr from "./cubeRenderer.constants";
import { CameraSystem } from "../cameraSystem";
import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";

const SHADER_DEFS = makeShaderDataDefinitions(code);

export class CubeRendererSystem extends System {
    public componentsRequired = new Set([
        TransformComponent,
        CubeComponent,
    ]);

    protected pipeline: GPURenderPipeline;
    protected module: GPUShaderModule;
    protected cubeVbo: GPUBuffer;

    protected uniforms = makeStructuredView(SHADER_DEFS.uniforms["uniforms"]);
    protected uniformsBuffer: GPUBuffer;
    protected uniformBindGroup: GPUBindGroup;

    protected instances: Float32Array;
    protected instanceBuffer: GPUBuffer;
    protected instanceBindGroup: GPUBindGroup;

    constructor(
        protected lightDirection: Vec3,
        public readonly maxInstances = 16384
    ) {
        super();

        this.instances = new Float32Array(this.maxInstances * cr.INSTANCE_SIZE);

        this.module = Game.gpu.device.createShaderModule({
            code,
        });

        this.pipeline = Game.gpu.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: this.module,
                buffers: [
                    {
                        arrayStride: 24,
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: "float32x3",
                            },
                            {
                                shaderLocation: 1,
                                offset: 12,
                                format: "float32x3",
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

        this.cubeVbo = Game.gpu.device.createBuffer({
            size: CUBE_VERTEX_DATA.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(this.cubeVbo.getMappedRange()).set(CUBE_VERTEX_DATA);
        this.cubeVbo.unmap();

        this.uniformsBuffer = Game.gpu.device.createBuffer({
            size: this.uniforms.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        this.uniformBindGroup = Game.gpu.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(cr.UNIFORM_BIND_GROUP),
            entries: [
                {
                    binding: cr.UNIFORM_BIND_GROUP_BINDING,
                    resource: { buffer: this.uniformsBuffer },
                },
            ],
        });

        this.instanceBuffer = Game.gpu.device.createBuffer({
            size: this.instances.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        this.instanceBindGroup = Game.gpu.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(cr.INSTANCE_BIND_GROUP),
            entries: [
                {
                    binding: cr.INSTANCE_BIND_GROUP_BINDING,
                    resource: { buffer: this.instanceBuffer },
                },
            ],
        });
    }

    public update(entities: Set<Entity>): void {
        // TODO(???): extract uniform code
        const cs = this.ecs.getSystem(CameraSystem);
        this.uniforms.set({
            viewProjection: cs.viewMatrix,
            sunDirection: this.lightDirection,
            deltaTime: Game.deltaTime,
            time: Game.time,
        });
        Game.gpu.device.queue.writeBuffer(
            this.uniformsBuffer,
            0,
            this.uniforms.arrayBuffer
        );

        let i = 0;
        for (const entity of entities) {
            const transform = this.ecs
                .getComponents(entity)
                .get(TransformComponent);
            const cubeRenderer = this.ecs
                .getComponents(entity)
                .get(CubeComponent);

            this.instances.set(transform.matrix, i * cr.INSTANCE_SIZE);
            this.instances.set(
                cubeRenderer.color,
                i * cr.INSTANCE_SIZE + cr.INSTANCE_COLOR_OFFSET
            );
            i++;
        }

        Game.gpu.device.queue.writeBuffer(
            this.instanceBuffer,
            0,
            this.instances,
            0,
            i * cr.INSTANCE_SIZE
        );

        cr.RENDER_PASS_DESCRIPTOR.colorAttachments[0].view =
            Game.gpu.canvasTextureView;
        cr.RENDER_PASS_DESCRIPTOR.depthStencilAttachment.view =
            Game.gpu.depthTextureView;

        const pass = Game.cmdEncoder.beginRenderPass(cr.RENDER_PASS_DESCRIPTOR);

        pass.setPipeline(this.pipeline);
        pass.setVertexBuffer(0, this.cubeVbo);
        pass.setBindGroup(cr.UNIFORM_BIND_GROUP, this.uniformBindGroup);
        pass.setBindGroup(cr.INSTANCE_BIND_GROUP, this.instanceBindGroup);

        pass.draw(CUBE_VERTEX_COUNT, entities.size);
        pass.end();
    }
}