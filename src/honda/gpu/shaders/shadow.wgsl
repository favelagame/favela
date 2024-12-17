struct Instance {
    transform: mat4x4<f32>,
    invTransform: mat4x4<f32>,
};

struct VertexIn {
    @builtin(instance_index) instanceIndex: u32,
    @location(0) position: vec3f,  
    @location(1) uv: vec2f,
};


@group(0) @binding(0) var<uniform> vp: mat4x4<f32>;
@group(0) @binding(1) var<storage, read> instances: array<Instance>;

@vertex
fn vertex_main(input: VertexIn) -> @builtin(position) vec4f {
    return vp * instances[input.instanceIndex].transform * vec4f(input.position, 1.0);
}

@fragment
fn fragment_main() { }