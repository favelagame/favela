// she g on my buffer till i deffered renderer

struct ShadeUniforms {
    VPInv: mat4x4f,
    camera: mat4x4f,
    nLights: u32,
};

struct Light {
    position: vec3f,
    direction: vec3f,
    color: vec3f,
    ltype: u32,
    intensity: f32,
    maxRange: f32,
    innerCone: f32,
    outerCone: f32,
}

const bigTri = array(
    vec2f(-1, 3),
    vec2f(-1, -1),
    vec2f(3, -1),
);

@group(0) @binding(0) var<uniform> uni: ShadeUniforms;
@group(0) @binding(1) var<uniform> lights: array<Light, 128>;  

@group(0) @binding(2) var gBase: texture_2d<f32>;
@group(0) @binding(3) var gNorm: texture_2d<f32>;
@group(0) @binding(4) var gMetRgh: texture_2d<f32>;
@group(0) @binding(5) var gEms: texture_2d<f32>;
@group(0) @binding(6) var gDepth: texture_depth_2d;

@group(0) @binding(7) var smp: sampler;


const L_POINT = 0u;
const L_DIR = 1u;
const L_SPOT = 2u; 

fn getScreenCoord(fragCoord: vec4f) -> vec2<f32> {
    return fragCoord.xy / vec2f(textureDimensions(gBase).xy);
}

fn reconstructPosition(screenCoord: vec2<f32>, depth: f32, invProj: mat4x4<f32>) -> vec3<f32> {
    let clipSpace = vec4<f32>(
        screenCoord.x * 2.0 - 1.0,
        1.0 - screenCoord.y * 2.0,
        depth,
        1.0
    );
    let viewSpace = invProj * clipSpace;
    return viewSpace.xyz / viewSpace.w;
}

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    return vec4f(bigTri[index], 0, 1);
}

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
    let fc = vec2u(fragCoord.xy);

    let dep = textureLoad(gDepth, fc, 0);
    if dep == 1.0 { discard; }

    // world pos
    let pos = reconstructPosition(
        getScreenCoord(fragCoord),
        dep,
        uni.VPInv
    );

    let bas = textureLoad(gBase, fc, 0).rgb;
    let nor = normalize(textureLoad(gNorm, fc, 0).rgb * 2.0 - vec3f(1.0));
    let metRgh = textureLoad(gMetRgh, fc, 0).rg;
    let ems = textureLoad(gEms, fc, 0).rgb;

    var lit = vec3f(0.0); 

    // fries in bag
    for (var i = 0u; i < uni.nLights; i++) {
        var atten = 1.0;
        var lightDir = vec3f(0.0);
        var light = lights[i];

        if light.ltype == L_DIR {
            // call me a directional light the way I don't fall off
            lightDir = normalize(-light.direction);
        } else {
            let delta = light.position - pos;
            lightDir = normalize(delta);
            let dist = length(delta);
            if dist > light.maxRange {
                continue;
            }
            atten = 1.0 / max(pow(dist, 4), 1.0);
        }

        if light.ltype == L_SPOT {
            // spotlight cone falloff
            let coneI = cos(light.innerCone);
            let coneO = cos(light.outerCone);

            atten *= clamp(
                (dot(
                    lightDir,
                    normalize(-light.direction)
                ) - coneO) / (coneI - coneO),
                0.0,
                1.0
            );
        }
        

        // Diffuse
        let NdotL = max(dot(nor, lightDir), 0.0);
        let dif = bas * light.color * atten * NdotL * light.intensity * 0.1;

        //TODO: Specular

        lit += dif;
    }

    lit += bas; // very lazy ambient impl

    return vec4f(lit + ems, 1.0);
}