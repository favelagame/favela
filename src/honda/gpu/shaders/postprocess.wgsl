
struct PostCfg {
    inverseProjection: mat4x4f,
    camera: mat4x4f,

    fogColor: vec3f,
    fogStart: f32,
    fogEnd: f32,
    fogDensity: f32,

    mode: u32,

    occlusionPower: f32,
    exposure: f32,
    gamma: f32,

    bloom: f32
};

const bigTri = array(
    vec2f(-1, 3),
    vec2f(-1, -1),
    vec2f(3, -1),
);

@group(0) @binding(0) var<uniform> post: PostCfg;
@group(0) @binding(1) var shaded: texture_2d<f32>;
@group(0) @binding(2) var depth: texture_depth_2d;
@group(0) @binding(3) var ssao: texture_2d<f32>;
@group(0) @binding(4) var bloom: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    return vec4f(bigTri[index], 0, 1);
}

fn getWorldDepth(depthValue: f32, p: vec2u) -> f32 {
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


fn reinhardToneMap(color: vec3f, exposure: f32) -> vec3f {
    return color * exposure / (color * exposure + vec3f(1.0));
}

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
    let p = vec2<u32>(fragCoord.xy);

    if post.mode == 0 { // Shade + SSAO + Post
        let depthValue = textureLoad(depth, p, 0);
        let d = getWorldDepth(depthValue, p);
        let o = textureLoad(ssao, p, 0).x;
        let shaded = textureLoad(shaded, p, 0) + textureLoad(bloom, p, 0) * post.bloom;

        let fogD = clamp(d - post.fogStart, 0.0, post.fogEnd - post.fogStart);
        let fogFactor = min(fogD * post.fogDensity, 1.0);

        let shadedColor = (shaded.xyz * pow(o, post.occlusionPower)) * (1.0 - fogFactor) + post.fogColor * fogFactor;

        let toneMappedColor = reinhardToneMap(shadedColor, post.exposure);

        let gammaCorrected = pow(toneMappedColor, vec3(1.0 / post.gamma));

        return vec4f(gammaCorrected, 1.0);
    } else { // Shade only 
        return vec4f(textureLoad(shaded, p, 0).xyz, 1.0);
    }
}
