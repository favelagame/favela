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
    @location(3) tangent: vec4f,
};

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) tangent: vec3f,
    @location(1) normal: vec3f,
    @location(2) uv: vec2f, 
    @location(3) w: f32,
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
@group(1) @binding(7) var tNorm: texture_2d<f32>;
@group(1) @binding(8) var sNorm: sampler;


@vertex
fn vertex_main(input: VertexIn) -> VertexOutput {
    let instance = instances[input.instanceIndex];
    let transformedPos = uniforms.viewProjection * instance.transform * vec4f(input.position, 1.0);
    var output: VertexOutput;

    let normalMatrix = transpose(
        mat3x3(
            instance.invTransform[0].xyz,
            instance.invTransform[1].xyz,
            instance.invTransform[2].xyz
        )
    );

    output.normal = normalMatrix * input.normal;
    output.tangent = normalMatrix * input.tangent.xyz;
    output.w = input.tangent.w;

    output.pos = transformedPos;
    output.uv = input.uv;
    return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> Gbuffer {
    let base = textureSample(tBase, sBase, input.uv) * material.baseFactor;
    if base.a < material.alphaCutoff {discard;}
    let mtlRgh = textureSample(tMtlRgh, sMtlRgh, input.uv).zy * vec2f(material.metalFactor, material.roughFactor);
    let ems = textureSample(tEms, sEms, input.uv).xyz * material.emissionFactor;

    let texNorm = textureSample(tNorm, sNorm, input.uv).xyz * 2.0 - 1.0;
    let scaledNorm = normalize(texNorm * vec3(vec2(material.normalScale), 1.0));

    let N = normalize(input.normal);
    let T = normalize(input.tangent);
    let B = normalize(cross(N, T) * input.w) ; // yep
    let TBN = mat3x3(T, B, N);
    let worldNorm = normalize(TBN * scaledNorm); // fries in bag

    var output: Gbuffer;
    output.base = vec4f(base.xyz, 1.0);
    output.normal = vec4f((worldNorm + 1) / 2.0, 0.0);
    output.mtlRgh = mtlRgh;
    output.emission = vec4f(ems, 1.0);
    return output;
}