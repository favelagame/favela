// Reach in the well for a necklace 
// Blood on the moon, it's crescent
// DG the new One Direction

struct BlurUniforms {
    v: vec2f,
    size: i32,
    krnl: array<vec4f,64>,
};

struct Vert {
    @builtin(position)  pos: vec4f,
    @location(0)        uv: vec2f,
};

const bigTri = array(
    vec2f(-1, 3),
    vec2f(-1, -1),
    vec2f(3, -1),
);

@group(0) @binding(0) var<uniform> uni: BlurUniforms;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> Vert {
    let pos = vec4f(bigTri[index], 0.0, 1.0);
    let uv = vec2f(pos.x + 1.0, 1.0 - pos.y) * 0.5;
    return Vert(pos, uv);
}

@fragment
fn fs(vo: Vert) -> @location(0) vec4f {
    var ax = vec4f(0.0);

    for (var i = 0; i <= 2 * uni.size; i++) {
        // fries in bag
        ax += textureSample(tex, smp, vo.uv + f32(i - uni.size) * uni.v) * uni.krnl[abs(i - uni.size)];
    }

    return ax;
}