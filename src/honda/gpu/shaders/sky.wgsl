struct SkyUniforms {
    view: mat4x4f,
    projection: mat4x4f
};

struct VertexIn {
    @location(0) position: vec3f,  
};

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) texc: vec3f,
};

@group(0) @binding(0) var<uniform> uniforms: SkyUniforms;
@group(0) @binding(1) var tSampler: sampler;
@group(0) @binding(2) var tSky: texture_cube<f32>;

@vertex
fn vertex_main(input: VertexIn) -> VertexOutput {
    var output: VertexOutput;
    let transformedPos = uniforms.projection * uniforms.view * vec4f(input.position, 1.0);

    var out: VertexOutput;
    out.pos = transformedPos;
    out.texc = input.position;
    return out;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    return textureSample(tSky, tSampler, input.texc) * 8.0; // TODO: expose this to the CPU
}