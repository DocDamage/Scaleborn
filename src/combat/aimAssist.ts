/** Angle-limited, deterministic aim aid for already centered targets.
 * It never selects an enemy, changes health/range or bypasses collision. */
export interface CombatPoint { x:number; y:number; z:number }

export function assistedDirection(
  base:CombatPoint,origin:CombatPoint,target:CombatPoint|null|undefined,
  maxAngle=.20,
):CombatPoint {
  if(!target || ![...Object.values(base),...Object.values(origin),
    ...Object.values(target),maxAngle].every(Number.isFinite)
    || maxAngle<=0 || maxAngle>.35)return {...base};
  const norm=Math.hypot(base.x,base.y,base.z);
  const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z;
  const range=Math.hypot(dx,dy,dz);
  if(norm<.0001||range<.25||range>90)return {...base};
  const raw={x:base.x/norm,y:base.y/norm,z:base.z/norm};
  const desired={x:dx/range,y:dy/range,z:dz/range};
  const facing=raw.x*desired.x+raw.y*desired.y+raw.z*desired.z;
  if(facing<Math.cos(maxAngle))return {...base};
  const k=.66, vector={
    x:raw.x*(1-k)+desired.x*k,
    y:raw.y*(1-k)+desired.y*k,
    z:raw.z*(1-k)+desired.z*k,
  };
  const size=Math.hypot(vector.x,vector.y,vector.z);
  return {x:vector.x/size,y:vector.y/size,z:vector.z/size};
}
