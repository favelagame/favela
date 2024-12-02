struct ShadeUniforms {
    inverseProjection: mat4x4f,
    camera: mat4x4f,
    sunDir: vec3f,
};

const bigTri = array(
    vec2f(-1, 3),
    vec2f(-1, -1),
    vec2f(3, -1),
);

@group(0) @binding(0) var<uniform> uni: ShadeUniforms;
@group(0) @binding(1) var gBase: texture_2d<f32>;
@group(0) @binding(2) var gNorm: texture_2d<f32>;
@group(0) @binding(3) var gMRE: texture_2d<f32>;
@group(0) @binding(4) var gDepth: texture_depth_2d;
@group(0) @binding(5) var smp: sampler;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    return vec4f(bigTri[index], 0, 1);
}

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
    let dep = textureLoad(gDepth, vec2u(fragCoord.xy), 0);
    if dep == 1.0 { discard; }
    let bas = textureLoad(gBase, vec2u(fragCoord.xy), 0);
    let nor = textureLoad(gNorm, vec2u(fragCoord.xy), 0);
    let mre = textureLoad(gMRE, vec2u(fragCoord.xy), 0);

    return vec4f(bas.xyz, 1.0); // fullbright
}