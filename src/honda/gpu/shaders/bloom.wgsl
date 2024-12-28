struct BloomUniforms {
    threshold: f32
};

const bigTri = array(
    vec2f(-1, 3),
    vec2f(-1, -1),
    vec2f(3, -1),
);

@group(0) @binding(0) var<uniform> uni: BloomUniforms;
@group(0) @binding(1) var shaded: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    return vec4f(bigTri[index], 0, 1);
}

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
    let p = vec2<u32>(fragCoord.xy);
    let in = textureLoad(shaded, p, 0);

    return vec4f(step(vec3(uni.threshold), in.rgb) * in.rgb, 1.0);
}