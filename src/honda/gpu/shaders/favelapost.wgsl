
struct PostCfg {
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

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
    // TODO: make depth be an actual unit not just some relative BS
    let d = (textureLoad(depth, vec2<u32>(fragCoord.xy), u32(0)) - 0.99) * 100;
    let dv = vec4f(d, d, d, 1);
    if post.mode == 0 {
        let base = textureLoad(color, vec2<u32>(fragCoord.xy), u32(0));
        return dv + (1 - d * d) * base;
    } else {
        return dv;
    }
}