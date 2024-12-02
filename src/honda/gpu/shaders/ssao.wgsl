
struct SSAOCfg {
    projection: mat4x4f,
    inverseProjection: mat4x4f,
    camera: mat4x4f,
    samples: array<vec3f,64>,

    kernelSize: u32,
    radius: f32,
    bias: f32,
};

const bigTri = array(
    vec2f(-1, 3),
    vec2f(-1, -1),
    vec2f(3, -1),
);

@group(0) @binding(0) var<uniform> ssao: SSAOCfg;
@group(0) @binding(1) var noise: texture_2d<f32>;
@group(0) @binding(2) var normal: texture_2d<f32>;
@group(0) @binding(3) var depth: texture_depth_2d;
@group(0) @binding(4) var lsampler: sampler;


@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    return vec4f(bigTri[index], 0, 1);
}

fn reconstructPosition(p: vec2u, dv: f32) -> vec3f {
    let dim = vec2f(textureDimensions(depth).xy);

    let ndc = vec4f(
        (f32(p.x) / dim.x) * 2.0 - 1.0,
        1.0 - (f32(p.y) / dim.y) * 2.0,
        dv,
        1.0
    );

    let viewSpacePos = ssao.inverseProjection * ndc;
    return viewSpacePos.xyz / viewSpacePos.w;
}

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
    let p = vec2u(fragCoord.xy);
    let norMat = transpose(mat3x3f(
        ssao.camera[0].xyz,
        ssao.camera[1].xyz,
        ssao.camera[2].xyz,
    ));

    let d = textureLoad(depth, p, 0);
    if d == 1.0 {
        return vec4f(1.0, 0.0, 0.0, 0.0); // early return on sky
    }

    let positionVec = reconstructPosition(p, d);
    let normalVec = normalize((textureLoad(normal, p, 0).xyz * 2.0 - vec3f(1.0, 1.0, 1.0)) * norMat);
    let randomVec = textureLoad(noise, vec2<u32>(p.x & 0x3, p.y & 0x3), 0).xyz;

    let tangent = normalize(randomVec - normalVec * dot(randomVec, normalVec));
    let bitangent = cross(normalVec, tangent);
    let tbn = mat3x3f(tangent, bitangent, normalVec);

    let dim = vec2f(textureDimensions(depth).xy);


    var occlusion = 0.0;
    for (var i = 0u; i < ssao.kernelSize; i++) {
        var samplePos = tbn * ssao.samples[i];
        samplePos = positionVec + samplePos * ssao.radius;

        let offset_ = ssao.projection * vec4f(samplePos, 1.0);
        let offset = (offset_.xyz / offset_.w) * 0.5 + 0.5;
        let p = vec2u(u32(offset.x * dim.x), u32((1.0 - offset.y) * dim.y));
        let sampleDepth = reconstructPosition(p, textureLoad(depth, p, 0)).z;
        let rangeCheck = smoothstep(0.0, 1.0, ssao.radius / abs(positionVec.z - sampleDepth));
        if sampleDepth >= samplePos.z + ssao.bias {
            occlusion += 1.0 * rangeCheck;
        }
    }

    return vec4f(1.0 - (occlusion / f32(ssao.kernelSize)), 0.0, 0.0, 0.0);
}