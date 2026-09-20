/**
 * CharacterFactory — the two wardrobes, matched 1:1 to the shipped reference
 * PNGs (assets/source-art/*). Both characters are MALE.
 *
 *   STUDENT — black suit (blazer + trousers), lavender collared shirt, dark tie,
 *             blue lanyard with an ID badge, curly black hair, black dress shoes.
 *   TEACHER — grey baseball cap, blue short-sleeve polo (collar + placket + logo),
 *             blue jeans with back pockets + belt loop, grey sneakers with white
 *             soles, a whistle on a ring at the belt.
 *
 * Each spec feeds CharacterBody.buildCharacterParts. Colours are sampled from
 * the PNGs; proportions keep the student slim/young and the teacher a stockier
 * adult.
 */
import { CHARACTER } from '../config.js';
import { skinMaterial, fabricMaterial, hairMaterial, plainMaterial } from './CharacterTextures.js';

const RADIAL = CHARACTER.BUILD.RADIAL_SEGMENTS;

/** Student: black suit, tie, lanyard/ID, curly hair, dress shoes. */
export function studentSpec() {
    const suit = 0x1b1b1f;
    return {
        targetHeight: CHARACTER.STUDENT_HEIGHT,
        radial: RADIAL,
        bulk: 0.94,
        outfit: 'suit',
        hairStyle: 'curly',
        headwear: null,
        bottomDetail: 'suit',
        shoeStyle: 'dress',
        accessory: null,
        castShadow: CHARACTER.SHADOWS,
        materials: {
            skin: skinMaterial(0xd9a06f),
            hair: hairMaterial(0x14100d),
            top: fabricMaterial(suit, { pattern: 'weave', repeat: 4, roughness: 0.62 }),   // blazer
            collar: fabricMaterial(0xf2f2f5, { pattern: 'weave', repeat: 5, roughness: 0.7 }), // shirt collar/cuff
            shirt: fabricMaterial(0xd9cfe9, { pattern: 'weave', repeat: 5, roughness: 0.7 }),  // lavender shirt V
            tie: fabricMaterial(0x2a2a2e, { pattern: 'stripe', repeat: 3, roughness: 0.5 }),
            lanyard: fabricMaterial(0x2f6fd0, { pattern: 'stripe', repeat: 2, roughness: 0.6 }),
            badge: plainMaterial(0xeef2f7, { roughness: 0.35 }),
            trouser: fabricMaterial(0x1e1e22, { pattern: 'weave', repeat: 3, roughness: 0.65 }), // suit trousers
            stitch: fabricMaterial(0x1e1e22, { pattern: 'weave', repeat: 3 }),
            shoe: plainMaterial(0x141416, { roughness: 0.35 }),
            sole: plainMaterial(0x0d0d0e, { roughness: 0.5 }),
            accent: plainMaterial(0x2f6fd0, { roughness: 0.5 }),
            metal: plainMaterial(0x26262a, { roughness: 0.3, metalness: 0.5 }),
            eyeWhite: plainMaterial(0xf6f6f6, { roughness: 0.25 }),
            eyeDark: plainMaterial(0x1c1410, { roughness: 0.2 }),
            mouth: plainMaterial(0x9c5250, { roughness: 0.6 }),
            cap: plainMaterial(0x8a8f96), capDark: plainMaterial(0x6e737a),
        },
    };
}

/** Teacher: grey cap, blue polo, jeans, sneakers, whistle. */
export function teacherSpec() {
    const polo = 0x4a90d2;
    const denim = 0x6b93c0;
    return {
        targetHeight: CHARACTER.TEACHER_HEIGHT,
        radial: RADIAL,
        bulk: 1.04,
        outfit: 'polo',
        hairStyle: 'short',
        headwear: 'cap',
        bottomDetail: 'jeans',
        shoeStyle: 'sneaker',
        accessory: 'whistle',
        castShadow: CHARACTER.SHADOWS,
        materials: {
            skin: skinMaterial(0xc98f63),
            hair: hairMaterial(0x39342f),                                   // salt-and-pepper crop
            top: fabricMaterial(polo, { pattern: 'knit', repeat: 5, roughness: 0.8 }),     // polo body+sleeves
            collar: fabricMaterial(0x3d7fc0, { pattern: 'knit', repeat: 5, roughness: 0.8 }), // collar+placket
            shirt: fabricMaterial(polo, { pattern: 'knit', repeat: 5 }),
            tie: plainMaterial(polo), lanyard: plainMaterial(polo), badge: plainMaterial(polo),
            trouser: fabricMaterial(denim, { pattern: 'weave', repeat: 4, roughness: 0.85 }), // jeans
            stitch: fabricMaterial(0x4f76a3, { pattern: 'weave', repeat: 4, roughness: 0.85 }), // pockets/seams
            shoe: plainMaterial(0x3a3f46, { roughness: 0.6 }),
            sole: plainMaterial(0xe8e8ea, { roughness: 0.7 }),
            accent: plainMaterial(0x1f5fa8, { roughness: 0.5 }),
            metal: plainMaterial(0xb8bcc2, { roughness: 0.3, metalness: 0.8 }),   // whistle
            eyeWhite: plainMaterial(0xf6f6f6, { roughness: 0.25 }),
            eyeDark: plainMaterial(0x241a12, { roughness: 0.2 }),
            mouth: plainMaterial(0x9c5250, { roughness: 0.6 }),
            cap: fabricMaterial(0x8a8f96, { pattern: 'weave', repeat: 3, roughness: 0.85 }),
            capDark: fabricMaterial(0x6e737a, { pattern: 'weave', repeat: 3, roughness: 0.85 }),
        },
    };
}
