
struct PostCfg {
    inverseProjection: mat4x4f,
    sunDir: vec3f,

    fogColor: vec3f,
    fogStart: f32,
    fogEnd: f32,
    fogDensity: f32,

    mode: u32,

    ambientRatio: f32,
    occlusionPower: f32,

    ssaoSamples: array<vec3f,64>,
};

const bigTri = array(
    vec2f(-1, 3),
    vec2f(-1, -1),
    vec2f(3, -1),
);

@group(0) @binding(0) var<uniform> post: PostCfg;
@group(0) @binding(1) var color: texture_2d<f32>;
@group(0) @binding(2) var normal: texture_2d<f32>;
@group(0) @binding(3) var depth: texture_depth_2d;
@group(0) @binding(4) var lsampler: sampler;
@group(0) @binding(5) var ssao: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    return vec4f(bigTri[index], 0, 1);
}

fn getWorldDepth(p: vec2u) -> f32 {
    let depthValue = textureLoad(depth, p, 0);
    let dim = vec2f(textureDimensions(depth).xy);

    let ndc = vec4f(
        (f32(p.x) / dim.x) * 2.0 - 1.0,
        1.0 - (f32(p.y) / dim.y) * 2.0,
        depthValue,
        1.0
    );

    let viewSpacePos = post.inverseProjection * ndc;
    let viewPos = viewSpacePos.xyz / viewSpacePos.w;

    return length(viewPos.xyz) / 10.0;
}

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
    let base = textureLoad(color, vec2<u32>(fragCoord.xy), 0);
    let nor = normalize(textureLoad(normal, vec2<u32>(fragCoord.xy), 0).xyz * 2.0 - vec3f(1.0, 1.0, 1.0));
    let d = getWorldDepth(vec2u(fragCoord.xy));
    let o = textureLoad(ssao, vec2<u32>(fragCoord.xy), 0).x;

    let sunf = max(dot(nor, normalize(post.sunDir)), 0);
    let diffuse = base.xyz * sunf * (1 - post.ambientRatio);
    let ambient = base.xyz * post.ambientRatio;

    if post.mode == 0 {
        // Fog + sun + AO
        let fogD = clamp(d - post.fogStart, 0, post.fogEnd - post.fogStart);
        let fogFactor = min(fogD * post.fogDensity, 1);
        return vec4f(((diffuse + ambient) * pow(o, post.occlusionPower)) * (1 - fogFactor) + post.fogColor * fogFactor, 1.0);
    } else if post.mode == 1 {
        // Fog + sun 
        let fogD = clamp(d - post.fogStart, 0, post.fogEnd - post.fogStart);
        let fogFactor = min(fogD * post.fogDensity, 1);
        return vec4f(((diffuse + ambient)) * (1 - fogFactor) + post.fogColor * fogFactor, 1.0);
    } else if post.mode == 2 {

        return vec4f(o, o, o, 1.0);
    } else {
        // depth debug
        return vec4f(d, d, d, 1);
    }
}