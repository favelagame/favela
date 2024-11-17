struct HondaUniforms {
    viewProjection: mat4x4<f32>,
    sunDirection: vec3<f32>,
    deltaTime: f32,
    time: f32,
};

struct Instance {
    transform: mat4x4<f32>,
    invTransform: mat4x4<f32>,
    color: vec3<f32>,
};

struct VertexIn {
    @location(0) position: vec3<f32>,  
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @builtin(instance_index) instanceIndex: u32,  
};

struct VertexOutput {
    @builtin(position) pos: vec4<f32>,
    @location(0) fragNormal: vec3<f32>, 
    @location(1) uv: vec2<f32>, 
};

struct Gbuffer {
    @location(0) baseColor: vec4f,
    @location(1) normal: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: HondaUniforms;
@group(1) @binding(0) var<storage, read> instances: array<Instance>;
@group(2) @binding(0) var tSampler: sampler;
@group(2) @binding(1) var tBase: texture_2d<f32>;

@vertex
fn vertex_main(input: VertexIn) -> VertexOutput {
    let instance = instances[input.instanceIndex];
    let transformedPos = uniforms.viewProjection * instance.transform * vec4f(input.position, 1.0);
    let normalMatrix = transpose(
        mat3x3(
            instance.invTransform[0].xyz,
            instance.invTransform[1].xyz,
            instance.invTransform[2].xyz
        )
    );

    var output: VertexOutput;
    output.pos = transformedPos;
    output.fragNormal = normalize(normalMatrix * input.normal);
    output.uv = input.uv;
    return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> Gbuffer {
    let texture = textureSample(tBase, tSampler, input.uv);
    if texture.w < 0.5 {discard;}

    var output: Gbuffer;
    output.baseColor = texture;
    output.normal = vec4f((input.fragNormal + vec3f(1, 1, 1)) / 2.0, 1.0);
    return output;
}