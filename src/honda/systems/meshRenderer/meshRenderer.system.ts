import { Vec3 } from "wgpu-matrix";
import { TransformComponent, Game, System, CameraSystem } from "@/honda/core";
import { MeshComponent } from "./meshRenderer.component";
import * as cr from "./meshRenderer.constants";
import { makeStructuredView } from "webgpu-utils";
import { MeshType } from "@/honda/gpu/meshes/mesh.interface";

export class MeshRendererSystem extends System {
    public componentsRequired = new Set([TransformComponent, MeshComponent]);

    protected gUniforms = makeStructuredView(
        Game.gpu.shaderModules.instancedTexturedMesh.defs.uniforms["uniforms"]
    );
    protected gUniformsBuffer: GPUBuffer;
    protected gUniformBindGroup: GPUBindGroup;

    protected instances: Float32Array;
    protected instanceBuffer: GPUBuffer;
    protected instanceBindGroup: GPUBindGroup;

    constructor(
        protected lightDirection: Vec3,
        public readonly maxInstances = 16384
    ) {
        super();

        this.gUniformsBuffer = Game.gpu.device.createBuffer({
            size: this.gUniforms.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        this.gUniformBindGroup = Game.gpu.device.createBindGroup({
            layout: Game.gpu.pipelines.instancedTextured.getBindGroupLayout(0),
            entries: [
                {
                    binding: cr.UNIFORM_BIND_GROUP_BINDING,
                    resource: { buffer: this.gUniformsBuffer },
                },
            ],
        });

        this.instances = new Float32Array(36 * maxInstances);
        this.instanceBuffer = Game.gpu.device.createBuffer({
            size: this.instances.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: false,
        });

        this.instanceBindGroup = Game.gpu.device.createBindGroup({
            layout: Game.gpu.pipelines.instancedTextured.getBindGroupLayout(1),
            entries: [
                {
                    binding: cr.INSTANCE_BIND_GROUP_BINDING,
                    resource: { buffer: this.instanceBuffer },
                },
            ],
        });
    }

    // eslint-disable-next-line class-methods-use-this
    public update(): void {}

    public drawToGbuffer() {
        const entities = Game.ecs.getEntitiesForSystem(this);

        const cs = this.ecs.getSystem(CameraSystem);
        this.gUniforms.set({
            viewProjection: cs.viewProjectionMatrix,
            sunDirection: this.lightDirection,
            deltaTime: Game.deltaTime,
            time: Game.time,
        });
        Game.gpu.device.queue.writeBuffer(
            this.gUniformsBuffer,
            0,
            this.gUniforms.arrayBuffer
        );

        const sortedEntities = Array.from(entities)
            .map((entity) => {
                const comp = this.ecs.getComponents(entity);
                return {
                    entity,
                    mc: comp.get(MeshComponent),
                    tc: comp.get(TransformComponent),
                };
            })
            .sort((a, b) => {
                if (a.mc.mesh.type !== b.mc.mesh.type) {
                    return a.mc.mesh.type.localeCompare(b.mc.mesh.type);
                }
                return a.mc.mesh.bufKey - b.mc.mesh.bufKey;
            });

        if (sortedEntities.length == 0) return;

        // just put the fries in the bag
        let pmt = "" as unknown as MeshType,
            pmk = -1;

        (cr.RENDER_PASS_DESCRIPTOR as GPURenderPassDescriptor).timestampWrites =
            Game.gpu.timestamp("MeshRenderer");
        cr.RENDER_PASS_DESCRIPTOR.colorAttachments[0].view =
            Game.gpu.colorTextureView;
        cr.RENDER_PASS_DESCRIPTOR.colorAttachments[1].view =
            Game.gpu.normalTextureView;
        cr.RENDER_PASS_DESCRIPTOR.depthStencilAttachment.view =
            Game.gpu.depthTextureView;
        const pass = Game.cmdEncoder.beginRenderPass(cr.RENDER_PASS_DESCRIPTOR);
        pass.setBindGroup(0, this.gUniformBindGroup);
        pass.setBindGroup(1, this.instanceBindGroup);

        let i = 0;
        let startInstance = 0;
        let previousDrawCount = 0;

        for (const x of sortedEntities) {
            this.instances.set(x.tc.matrix, i * cr.INSTANCE_SIZE);
            this.instances.set(
                x.tc.invMatrix,
                i * cr.INSTANCE_SIZE + cr.INSTANCE_INV_TRANSFORM_OFFSET
            );
            this.instances.set(
                x.mc.color,
                i * cr.INSTANCE_SIZE + cr.INSTANCE_COLOR_OFFSET
            );

            if (pmt != x.mc.mesh.type) {
                pmt = x.mc.mesh.type;
                if (startInstance != i) {
                    pass.drawIndexed(
                        previousDrawCount,
                        i - startInstance,
                        0,
                        0,
                        startInstance
                    );
                    startInstance = i;
                }
                pass.setPipeline(Game.gpu.pipelines.instancedTextured);
            }

            if (pmk != x.mc.mesh.bufKey) {
                pmk = x.mc.mesh.bufKey;
                if (startInstance != i) {
                    pass.drawIndexed(
                        previousDrawCount,
                        i - startInstance,
                        0,
                        0,
                        startInstance
                    );
                    startInstance = i;
                }
                previousDrawCount = x.mc.mesh.drawCount;
                x.mc.mesh.attach(pass);
            }
            i++;
        }

        if (startInstance != i) {
            pass.drawIndexed(
                previousDrawCount,
                i - startInstance,
                0,
                0,
                startInstance
            );
            startInstance = i;
        }

        Game.gpu.device.queue.writeBuffer(
            this.instanceBuffer,
            0,
            this.instances
        );
        pass.end();
    }
}
