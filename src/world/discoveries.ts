import { LANDMARKS, type WorldAnchor } from './terrain';

export const DISCOVERY_RADIUS_METERS = 95;
export interface NearbyLandmark {
  id: string;
  name: string;
  meters: number;
}

const labels: Record<string, string> = {
  'azure.harbor': 'Tidehaven Harbor',
  'azure.lighthouse': 'The Sunward Beacon',
  'azure.temple': 'Temple of the First Tide',
  'azure.sea-arch': 'The Skybreak Arch',
};

function display(anchor: WorldAnchor, x: number, z: number): NearbyLandmark {
  return {
    id: anchor.id,
    name: labels[anchor.id] ?? anchor.id,
    meters: Math.hypot(x - anchor.x, z - anchor.z),
  };
}

/** In-memory exploration progress for this prototype; persistence planned for G5. */
export class CoastDiscovery {
  private visited = new Set<string>();

  update(x: number, z: number): NearbyLandmark[] {
    const newlyFound: NearbyLandmark[] = [];
    for (const anchor of LANDMARKS) {
      const result = display(anchor, x, z);
      if (result.meters <= DISCOVERY_RADIUS_METERS && !this.visited.has(result.id)) {
        this.visited.add(result.id);
        newlyFound.push(result);
      }
    }
    return newlyFound;
  }

  nearest(x: number, z: number): NearbyLandmark | null {
    let result: NearbyLandmark | null = null;
    for (const anchor of LANDMARKS) {
      if (this.visited.has(anchor.id)) continue;
      const nearby = display(anchor, x, z);
      if (!result || nearby.meters < result.meters) result = nearby;
    }
    return result;
  }

  count(): number {
    return this.visited.size;
  }

  visitedIds(): readonly string[] {
    return [...this.visited].sort();
  }
}
