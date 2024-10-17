import { Mat4, vec3, Vec3 } from "wgpu-matrix";
import { Component, Entity, System } from "../ecs";
import { CTransform } from "./transform";
import { Game } from "../state";
import code from "../shaders/basicMesh.wgsl?raw";

// prettier-ignore
const cubeVertices = new Float32Array([
        // Front face
        -1.0, -1.0,  1.0,  0.0,  0.0,  1.0,
         1.0, -1.0,  1.0,  0.0,  0.0,  1.0,
         1.0,  1.0,  1.0,  0.0,  0.0,  1.0,
        -1.0, -1.0,  1.0,  0.0,  0.0,  1.0,
         1.0,  1.0,  1.0,  0.0,  0.0,  1.0,
        -1.0,  1.0,  1.0,  0.0,  0.0,  1.0,

        // Back face
        -1.0, -1.0, -1.0,  0.0,  0.0, -1.0,
        -1.0,  1.0, -1.0,  0.0,  0.0, -1.0,
         1.0,  1.0, -1.0,  0.0,  0.0, -1.0,
        -1.0, -1.0, -1.0,  0.0,  0.0, -1.0,
         1.0,  1.0, -1.0,  0.0,  0.0, -1.0,
         1.0, -1.0, -1.0,  0.0,  0.0, -1.0,

        // Top face
        -1.0,  1.0, -1.0,  0.0,  1.0,  0.0,
        -1.0,  1.0,  1.0,  0.0,  1.0,  0.0,
         1.0,  1.0,  1.0,  0.0,  1.0,  0.0,
        -1.0,  1.0, -1.0,  0.0,  1.0,  0.0,
         1.0,  1.0,  1.0,  0.0,  1.0,  0.0,
         1.0,  1.0, -1.0,  0.0,  1.0,  0.0,

        // Bottom face
        -1.0, -1.0, -1.0,  0.0, -1.0,  0.0,
         1.0, -1.0,  1.0,  0.0, -1.0,  0.0,
        -1.0, -1.0,  1.0,  0.0, -1.0,  0.0,
        -1.0, -1.0, -1.0,  0.0, -1.0,  0.0,
         1.0, -1.0, -1.0,  0.0, -1.0,  0.0,
         1.0, -1.0,  1.0,  0.0, -1.0,  0.0,

        // Right face
         1.0, -1.0, -1.0,  1.0,  0.0,  0.0,
         1.0,  1.0,  1.0,  1.0,  0.0,  0.0,
         1.0, -1.0,  1.0,  1.0,  0.0,  0.0,
         1.0, -1.0, -1.0,  1.0,  0.0,  0.0,
         1.0,  1.0, -1.0,  1.0,  0.0,  0.0,
         1.0,  1.0,  1.0,  1.0,  0.0,  0.0,

        // Left face
        -1.0, -1.0, -1.0, -1.0,  0.0,  0.0,
        -1.0, -1.0,  1.0, -1.0,  0.0,  0.0,
        -1.0,  1.0,  1.0, -1.0,  0.0,  0.0,
        -1.0, -1.0, -1.0, -1.0,  0.0,  0.0,
        -1.0,  1.0,  1.0, -1.0,  0.0,  0.0,
        -1.0,  1.0, -1.0, -1.0,  0.0,  0.0,
]);

export class CCubeRenderer extends Component {
    public color: Vec3;
    constructor(r: number, g: number, b: number) {
        super();
        this.color = vec3.create(r, g, b);
    }
}

export class CubeRendererSystem extends System {
    public componentsRequired = new Set([CTransform, CCubeRenderer]);

    protected pipeline: GPURenderPipeline;
    protected module: GPUShaderModule;
    protected cubeVbo: GPUBuffer;
    protected uniforms: GPUBuffer;
    protected uniformBindGroup: GPUBindGroup;

    protected instances = new Float32Array(20 * 128);
    protected instanceBuffer: GPUBuffer;
    protected instanceBindGroup: GPUBindGroup;

    constructor(protected cameraMatrix: Mat4, protected lightDirection: Vec3) {
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
            // depthStencil: {
            //     depthWriteEnabled: true,
            //     depthCompare: "less",
            //     format: "depth24plus",
            // },
        });

        // upload cube data to GPU
        this.cubeVbo = Game.gpu.device.createBuffer({
            size: cubeVertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(this.cubeVbo.getMappedRange()).set(cubeVertices);
        this.cubeVbo.unmap();

        // upload uniforms to GPU
        const uniforms = new Float32Array(20);

        uniforms.set(cameraMatrix, 0);
        uniforms.set(lightDirection, 16);

        this.uniforms = Game.gpu.device.createBuffer({
            size: uniforms.byteLength,
            usage: GPUBufferUsage.UNIFORM,
            mappedAtCreation: true,
        });

        console.log(uniforms);
        new Float32Array(this.uniforms.getMappedRange()).set(uniforms);
        this.uniforms.unmap();

        this.uniformBindGroup = Game.gpu.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniforms },
                },
            ],
        });

        this.instanceBuffer = Game.gpu.device.createBuffer({
            size: 128 * 20 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        this.instanceBindGroup = Game.gpu.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.instanceBuffer },
                },
            ],
        });
    }

    public update(entities: Set<Entity>): void {
        let i = 0;
        for (const entity of entities) {
            const transform = this.ecs.getComponents(entity).get(CTransform);
            const cubeRenderer = this.ecs
                .getComponents(entity)
                .get(CCubeRenderer);

            this.instances.set(transform.transform, i * 20);
            this.instances.set(cubeRenderer.color, i * 20 + 16);
            // console.log(entity, cubeRenderer, transform);
            // throw 1;
            i++;
        }

        Game.gpu.device.queue.writeBuffer(
            this.instanceBuffer,
            0,
            this.instances,
            0,
            i * 20
        );

        const pass = Game.cmdEncoder.beginRenderPass({
            label: "CubeRenderer",
            // depthStencilAttachment: {
            //     view: Game.gpu.depthTexture.createView(),
            //     depthLoadOp: "load",
            //     depthStoreOp: "store",
            // },
            colorAttachments: [
                {
                    view: Game.gpu.ctx.getCurrentTexture().createView(),
                    loadOp: "load",
                    storeOp: "store",
                },
            ],
        });

        pass.setPipeline(this.pipeline);
        pass.setVertexBuffer(0, this.cubeVbo);
        pass.setBindGroup(0, this.uniformBindGroup);
        pass.setBindGroup(1, this.instanceBindGroup);

        pass.draw(36, entities.size);
        pass.end();
    }
}
