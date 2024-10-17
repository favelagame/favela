struct Uniforms {
    viewProjection: mat4x4<f32>,
    sunDirection: vec3<f32>,
};

struct Instance {
    transform: mat4x4<f32>,
    color: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var<storage, read> instances: array<Instance>;

struct VertexIn {
    @location(0) position: vec3<f32>,  
    @location(1) normal: vec3<f32>,    
    @builtin(instance_index) instanceIndex: u32,  
};

struct VertexOutput {
    @builtin(position) pos: vec4<f32>,  
    @location(0) fragNormal: vec3<f32>, 
    @location(1) fragColor: vec3<f32>,  
};

@vertex
fn vertex_main(input: VertexIn) -> VertexOutput {
    let instance = instances[input.instanceIndex];

    let transformedPos = uniforms.viewProjection * instance.transform * vec4<f32>(input.position, 1.0);

    var output: VertexOutput;
    output.pos = transformedPos;
    output.fragNormal = input.normal;
    output.fragColor = instance.color;
    return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let lightDir = normalize(uniforms.sunDirection);
    let normal = normalize(input.fragNormal);

    let diffuse = max(dot(normal, lightDir), 0.05);

    return vec4<f32>(input.fragColor * diffuse, 1.0);
}