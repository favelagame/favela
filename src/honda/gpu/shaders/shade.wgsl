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

    shadowMap: i32,
    VP: mat4x4f,
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

@group(0) @binding(8) var shadowMaps: texture_depth_2d_array;
@group(0) @binding(9) var shadowSampler: sampler_comparison;


const L_POINT = 0u;
const L_DIR = 1u;
const L_SPOT = 2u; 

const PI: f32 = 3.14159265358979323846264338327950288;

fn getScreenCoord(fragCoord: vec4f) -> vec2<f32> {
    return fragCoord.xy / vec2f(textureDimensions(gBase).xy);
}

fn reconstructPosition(screenCoord: vec2<f32>, depth: f32, invProj: mat4x4<f32>) -> vec3f {
    let clipSpace = vec4<f32>(
        screenCoord.x * 2.0 - 1.0,
        1.0 - screenCoord.y * 2.0,
        depth,
        1.0
    );
    let viewSpace = invProj * clipSpace;
    return viewSpace.xyz / viewSpace.w;
}

fn schlick_fresnel(f0: vec3f, cos_theta: f32) -> vec3f {
    return f0 + (1.0 - f0) * pow(1.0 - cos_theta, 5.0);
}

fn ggx_distribution(ndh: f32, roughness: f32) -> f32 {
    let alpha = roughness * roughness;
    let alpha2 = alpha * alpha;
    let ndh2 = ndh * ndh;
    let denom = ndh2 * (alpha2 - 1.0) + 1.0;
    return alpha2 / (PI * denom * denom);
}

fn geometry_schlick_ggx(ndv: f32, roughness: f32) -> f32 {
    let k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
    return ndv / (ndv * (1.0 - k) + k);
}

fn geometry_smith(ndv: f32, ndl: f32, roughness: f32) -> f32 {
    let ggx_v = geometry_schlick_ggx(ndv, roughness);
    let ggx_l = geometry_schlick_ggx(ndl, roughness);
    return ggx_v * ggx_l;
}

fn brdf_metallic_roughness(
    normal: vec3f,
    view_dir: vec3f,
    light_dir: vec3f,
    base_color: vec3f,
    metallic: f32,
    roughness: f32
) -> vec3f {
    let halfway_dir = normalize(view_dir + light_dir);

    // Dot products
    let ndl = max(dot(normal, light_dir), 0.0);
    let ndv = max(dot(normal, view_dir), 0.0);
    let ndh = max(dot(normal, halfway_dir), 0.0);
    let vdh = max(dot(view_dir, halfway_dir), 0.0);

    // Fresnel term
    let f0 = mix(vec3f(0.04), base_color, metallic);
    let fresnel = schlick_fresnel(f0, vdh);

    // Microfacet specular term
    let d = ggx_distribution(ndh, roughness);
    let g = geometry_smith(ndv, ndl, roughness);
    let specular = fresnel * (d * g / (4.0 * ndv * ndl + 0.001));

    // Diffuse term (Lambertian)
    let diffuse_color = base_color * (1.0 - metallic);
    let diffuse = diffuse_color / PI;

    // Combine terms
    return (diffuse + specular) * ndl;
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
    let N = normalize(textureLoad(gNorm, fc, 0).rgb * 2.0 - 1.0);
    let metRgh = textureLoad(gMetRgh, fc, 0).rg;
    let met = metRgh.r;
    let rgh = metRgh.g;
    let ems = textureLoad(gEms, fc, 0).rgb;
    let V = normalize(uni.VPInv[3].xyz - pos);

    var lit = vec3f(0.0);

    // fries in bag
    for (var i = 0u; i < uni.nLights; i++) {
        var atten = 1.0;
        var L = vec3f(0.0);
        var light = lights[i];

        if light.ltype == L_DIR {
            // call me a directional light the way I don't fall off
            L = normalize(-light.direction);
        } else {
            let delta = light.position - pos;
            L = normalize(delta);
            let dist = length(delta);
            //TODO(mbabnik): uniformity BS
            // if dist > light.maxRange { continue; }
            atten = 1.0 / max(pow(dist, 2), 0.0001);
        }

        if light.ltype == L_SPOT {
            // spotlight cone falloff
            let coneI = cos(light.innerCone);
            let coneO = cos(light.outerCone);

            atten *= clamp(
                (dot(
                    L,
                    normalize(-light.direction)
                ) - coneO) / (coneI - coneO),
                0.0,
                1.0
            );
        }

        if light.shadowMap >= 0 {
            let projected = light.VP * vec4(pos, 1.0);
            let ndc = projected.xyz / projected.w;
            let texCoords = vec2f(0.5, -0.5) * ndc.xy + 0.5;

            atten *= textureSampleCompare(
                shadowMaps,
                shadowSampler,
                texCoords,
                light.shadowMap,
                ndc.z - 0.000002
            );
        }


        // Diffuse
        if false {
            let NdotL = max(dot(N, L), 0.0);
            let dif = bas * light.color * atten * NdotL * (light.intensity);
            //TODO: Specular

            lit += dif;
        } else {
            lit += light.color * atten * light.intensity * 0.1 * brdf_metallic_roughness(
                N,
                V,
                L,
                bas,
                met,
                rgh
            );
        }
    }
    // lit /= 50.0;
    lit += bas; // very lazy ambient impl

    return vec4f(lit + ems, 1.0);
}