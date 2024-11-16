struct HondaUniforms {
    viewProjection: mat4x4<f32>,
    sunDirection: vec3<f32>,
    deltaTime: f32,
    time: f32,
};

struct Instance {
    transform: mat4x4<f32>,
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

fn inverseMat3x3(m: mat3x3<f32>) -> mat3x3<f32> {
    let det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

    if abs(det) < 1e-6 {
        return mat3x3<f32>(1, 0, 0, 0, 1, 0, 0, 0, 1);
    }

    return mat3x3<f32>(
        (m[1][1] * m[2][2] - m[1][2] * m[2][1]) / det,
        (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / det,
        (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / det,
        (m[1][2] * m[2][0] - m[1][0] * m[2][2]) / det,
        (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / det,
        (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / det,
        (m[1][0] * m[2][1] - m[1][1] * m[2][0]) / det,
        (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / det,
        (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / det
    );
}



@group(0) @binding(0) var<uniform> uniforms: HondaUniforms;
@group(1) @binding(0) var<storage, read> instances: array<Instance>;
@group(2) @binding(0) var tSampler: sampler;
@group(2) @binding(1) var tBase: texture_2d<f32>;

@vertex
fn vertex_main(input: VertexIn) -> VertexOutput {
    let instance = instances[input.instanceIndex];

    let transformedPos = uniforms.viewProjection * instance.transform * vec4<f32>(input.position, 1.0);

    var output: VertexOutput;
    output.pos = transformedPos;
    
    output.fragNormal = transpose(inverseMat3x3(mat3x3(
        instance.transform[0].xyz,
        instance.transform[1].xyz,
        instance.transform[2].xyz
    ))) * input.normal;
    output.uv = input.uv;

    return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
    let texture =  textureSample(tBase, tSampler, input.uv);
    if (texture.w < 0.5) {discard;}
    let albedo = texture.xyz;

    let lightDir = normalize(uniforms.sunDirection);
    let normal = normalize(input.fragNormal);


    let diffuse = albedo * max(dot(normal, lightDir), 0) * 0.7;
    let ambient = albedo * 0.3;

    return vec4<f32>(diffuse + ambient, 1.0);
}