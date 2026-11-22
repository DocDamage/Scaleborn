import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const assets = [
  {
    id: 'creature.dragon.onyx',
    name: 'onyx-rigged.glb',
    url: 'https://afk.ai/auto-rig-models/dragon.glb',
    creator: 'afk.ai',
    license: 'CC0-1.0',
  },
  {
    id: 'character.rider.hero',
    name: 'hero-rigged.glb',
    url: 'https://grab3d.com/dl/elf-rigged/elf-rigged.glb',
    creator: 'Grab3D',
    license: 'CC0-1.0',
  },
];
const dest = resolve('public/models/characters');
const limitBytes = 48 * 1024 * 1024;

function validateGlb(data, name) {
  if (data.byteLength < 256 || data.byteLength > limitBytes
    || data.readUInt32LE(0) !== 0x46546c67
    || data.readUInt32LE(4) !== 2
    || data.readUInt32LE(8) !== data.byteLength) {
    throw new Error(name + ': not a valid glTF v2 binary, or exceeds size limit');
  }
  const jsonSize = data.readUInt32LE(12);
  if (data.readUInt32LE(16) !== 0x4e4f534a || 20 + jsonSize > data.length) {
    throw new Error(name + ': missing glTF JSON chunk');
  }
  const json = JSON.parse(data.subarray(20, 20 + jsonSize).toString('utf8'));
  if (!json.asset?.version?.startsWith('2.') || !json.meshes?.length
    || !json.skins?.length || !json.animations?.length) {
    throw new Error(name + ': expected real skinned mesh and animation clips');
  }
  return { meshes: json.meshes.length, skins: json.skins.length,
    animations: json.animations.map((a) => a.name || 'unnamed') };
}

async function acquire(asset) {
  const target = resolve(dest, asset.name);
  let data;
  let fetched = false;
  try {
    data = await readFile(target);
    validateGlb(data, asset.name);
  } catch {
    const response = await fetch(asset.url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Scaleborn-Asset-Vendor/1.0 (CC0 3D game assets)' },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error('Asset download failed for ' + asset.id + ': ' + response.status);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > limitBytes) throw new Error('Asset exceeds size limit: ' + asset.id);
    data = Buffer.from(await response.arrayBuffer());
    fetched = true;
  }
  const info = validateGlb(data, asset.name);
  if (fetched) await writeFile(target, data);
  const digest = createHash('sha256').update(data).digest('hex');
  console.log(asset.id + ': ' + data.byteLength + ' bytes, '
    + info.skins + ' skin(s), ' + info.animations.length + ' clips; SHA256 ' + digest);
  return {
    id: asset.id, file: asset.name, bytes: data.byteLength,
    sha256: digest, url: asset.url, license: asset.license,
    creator: asset.creator, gltf: info,
  };
}

await mkdir(dest, { recursive: true });
const manifest = [];
for (const asset of assets) manifest.push(await acquire(asset));
await writeFile(resolve(dest, 'sources.json'), JSON.stringify({
  description: 'Scaleborn character-source provenance (original CC0 rigged GLBs)',
  assets: manifest,
}, null, 2) + '\n');
