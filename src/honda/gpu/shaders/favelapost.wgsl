
struct PostCfg {
    inverseProjection: mat4x4f,

    //TODO: fog
    fogStart: f32,
    fogEnd: f32,
    fogDensity: f32,
    fogColor: vec3f,

    mode: u32,
};

const bigTri = array(
    vec2f(-1, 3),
    vec2f(-1, -1),
    vec2f(3, -1),
);

@group(0) @binding(0) var<uniform> post: PostCfg;
@group(0) @binding(1) var color: texture_2d<f32>;
@group(0) @binding(2) var depth: texture_depth_2d;

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
    let base = textureLoad(color, vec2<u32>(fragCoord.xy), u32(post.mode));
    let d = getWorldDepth(vec2u(fragCoord.xy));

    if post.mode == 0 {
        // How much of the distance is inside the fog
        let fogD = clamp(d - post.fogStart, 0, post.fogEnd - post.fogStart);
        let fogFactor = min(fogD * post.fogDensity, 1);

        return vec4f(base.xyz * (1-fogFactor) + post.fogColor * fogFactor, 1.0);
    } else {
        // depth debug
        return vec4f(d, d, d, 1);
    }
}