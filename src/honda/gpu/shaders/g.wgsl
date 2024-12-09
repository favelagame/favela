struct Uniforms {
    viewProjection: mat4x4<f32>,
    deltaTime: f32,
    time: f32,
};

struct Instance {
    transform: mat4x4<f32>,
    invTransform: mat4x4<f32>,
};

struct Material {
    baseFactor: vec4f,
    emissionFactor: vec3f,
    metalFactor: f32,
    roughFactor: f32,
    normalScale: f32,
    alphaCutoff: f32,
    ignoreAlpha: u32
};

struct VertexIn {
    @builtin(instance_index) instanceIndex: u32,
    @location(0) position: vec3f,  
    @location(1) uv: vec2f,
    @location(2) normal: vec3f,
};

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) fragNormal: vec3f, 
    @location(1) uv: vec2f, 
};

struct Gbuffer {
    @location(0) base: vec4f,
    @location(1) normal: vec4f,
    @location(2) mtlRgh: vec2f,
    @location(3) emission: vec4f,
}

// Pass group
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> instances: array<Instance>;
// Material group
@group(1) @binding(0) var<uniform> material: Material;
@group(1) @binding(1) var tBase: texture_2d<f32>;
@group(1) @binding(2) var sBase: sampler;
@group(1) @binding(3) var tMtlRgh: texture_2d<f32>;
@group(1) @binding(4) var sMtlRgh: sampler;
@group(1) @binding(5) var tEms: texture_2d<f32>;
@group(1) @binding(6) var sEms: sampler;


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
    let base = textureSample(tBase, sBase, input.uv) * material.baseFactor;
    if material.ignoreAlpha < 1 && base.w < material.alphaCutoff {discard;}
    let mtlRgh = textureSample(tMtlRgh, sMtlRgh, input.uv).zy * vec2f(material.metalFactor, material.roughFactor);
    let ems = textureSample(tEms, sEms, input.uv).xyz * material.emissionFactor;

    var output: Gbuffer;
    // this treats ignoreAlpha as always true... Which isn't wrong ig?
    output.base = vec4f(base.xyz, 1.0);
    output.normal = vec4f((input.fragNormal + vec3f(1, 1, 1)) / 2.0, 1.0);
    output.mtlRgh = mtlRgh;
    output.emission = vec4f(ems, 1.0);
    return output;
}