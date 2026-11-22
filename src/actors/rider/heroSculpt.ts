import * as THREE from 'three';
import { taperedSpine, sculptFin } from '../dragon/organicSculpt';
import { makeRiderFabricTextures } from './riderFabric';

/**
 * Original adolescent dragon-human heroine. Her slender coastal-traveller
 * silhouette, small swept horns and articulated draconic tail are authored
 * here; no unrelated adult elf/ranger model is used.
 *
 * All parts attach to reusable limb pivots so the existing portable rider
 * pose channels keep working on foot, underwater and while mounted.
 */
type Profile = readonly [height:number, width:number, depth:number, z:number];

function shapedTorso(
  profile: readonly Profile[], material:THREE.Material, name:string,
  samples=36, radial=24, region:'plain'|'face'='plain',
):THREE.Mesh {
  const positions:number[]=[], uvs:number[]=[], index:number[]=[];
  const rising=profile[profile.length-1]![0]>=profile[0]![0];
  for(let i=0;i<=samples;i++){
    const t=i/samples;
    const f=t*(profile.length-1), k=Math.min(profile.length-2,Math.floor(f));
    const u=f-k;
    const a=profile[k]!, b=profile[k+1]!;
    // Cubic cross-section interpolation gives cheeks, sleeves and boot shafts
    // continuous tangents instead of the pinched bands of smoothstep rings.
    const blend=(channel:number):number=>{
      const prev=profile[Math.max(0,k-1)]![channel]!;
      const next=profile[Math.min(profile.length-1,k+2)]![channel]!;
      const m0=(b[channel]!-prev)*.5,m1=(next-a[channel]!)*.5;
      const value=(2*u*u*u-3*u*u+1)*a[channel]!
        +(u*u*u-2*u*u+u)*m0
        +(-2*u*u*u+3*u*u)*b[channel]!
        +(u*u*u-u*u)*m1;
      return channel===1||channel===2?Math.max(.004,value):value;
    };
    const y=a[0]+(b[0]-a[0])*u;
    const width=blend(1),depth=blend(2),centerZ=blend(3);
    for(let j=0;j<=radial;j++){
      const angle=j/radial*Math.PI*2;
      const nx=Math.cos(angle),forward=Math.max(0,-Math.sin(angle));
      const cheek=region==='face'
        ? Math.exp(-Math.pow((y-1.303)/.072,2)*2)
          *Math.exp(-Math.pow((Math.abs(nx)-.70)/.28,2)*2)*forward
        : 0;
      const jaw=region==='face'
        ? Math.exp(-Math.pow((y-1.228)/.058,2)*2):0;
      const r=region==='face'?0:.0022*Math.sin(angle*7+t*19);
      positions.push(nx*(width+r)*(1-.033*jaw),
        y,centerZ+Math.sin(angle)*(depth+r)-cheek*.013);
      uvs.push(j/radial,t);
      if(i<samples&&j<radial) {
        const base=i*(radial+1)+j,next=base+radial+1;
        if (rising) index.push(base,next,base+1,base+1,next,next+1);
        else index.push(base,base+1,next,base+1,next+1,next);
      }
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(index);g.computeVertexNormals();
  const m=new THREE.Mesh(g,material);m.name=name;
  m.castShadow=true;
  return m;
}

function material(color:number, roughness=.9):THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({color,roughness,metalness:0.0});
}

const fabric = makeRiderFabricTextures();
function woven(color:number, roughness=.93):THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,roughness,metalness:0,
    map:fabric.color, normalMap:fabric.normal, roughnessMap:fabric.roughness,
  });
  mat.normalScale.set(.16,.16);
  return mat;
}

function smallEye(parent:THREE.Group,side:number,
  skin:THREE.Material,eye:THREE.Material,iris:THREE.Material):void {
  // Small almond-shaped eyes sit against the facial surface rather than
  // floating as round green toy-like globes in real close-up screenshots.
  const white = new THREE.Mesh(new THREE.SphereGeometry(1,18,14),eye);
  white.name=side<0?'rider.eye.left':'rider.eye.right';
  white.position.set(side*.086,1.295,-.148);
  white.scale.set(.038,.018,.006);
  parent.add(white);
  const jewel=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),iris);
  jewel.name=side<0?'rider.iris.left':'rider.iris.right';
  jewel.position.set(side*.086,1.295,-.155);
  jewel.scale.set(.012,.014,.0045);
  parent.add(jewel);
  // Curved upper and lower eyelids partially enclose the thin almond eye.
  // They hide the exposed sphere edges that appeared googly in real WebGL QA.
  const upperLid = new THREE.Mesh(taperedSpine([
    [side*.047,1.309,-.142],[side*.085,1.320,-.158],
    [side*.122,1.306,-.145],
  ],.011,10,20),skin);
  upperLid.name=side<0?'rider.eyelid.upper.left':'rider.eyelid.upper.right';
  parent.add(upperLid);
  const lowerLid = new THREE.Mesh(taperedSpine([
    [side*.047,1.280,-.143],[side*.086,1.277,-.156],
    [side*.122,1.285,-.146],
  ],.008,10,20),skin);
  lowerLid.name=side<0?'rider.eyelid.lower.left':'rider.eyelid.lower.right';
  parent.add(lowerLid);
  const brow=new THREE.Mesh(taperedSpine([
    [side*.040,1.346,-.143],[side*.086,1.358,-.157],
    [side*.133,1.345,-.133],
  ],.018,8),skin);
  brow.name=side<0?'rider.brow.left':'rider.brow.right';
  parent.add(brow);
}

function createRiderArm(
  parent:THREE.Group,side:-1|1,
  coat:THREE.Material,skin:THREE.Material,trim:THREE.Material,
):THREE.Group {
  const arm=new THREE.Group();
  arm.name=side<0?'rider.leftArm':'rider.rightArm';
  arm.position.set(side*.228,1.107,-.018);
  const sleeve=shapedTorso([
    [.025,.066,.077,0],[0,.073,.082,-.008],
    [-.13,.083,.089,-.018],[-.25,.075,.084,-.032],
    [-.355,.063,.073,-.044],
  ],coat,'rider.sleeve',34);
  arm.add(sleeve);
  // Separate elbow pivot allows hands to brace in mounted flight without
  // turning the entire straight sleeve into a rigid diagonal plank.
  const elbow=new THREE.Group();
  elbow.name=side<0?'rider.leftElbow':'rider.rightElbow';
  elbow.position.set(0,-.335,-.039);
  elbow.add(shapedTorso([
    [.005,.063,.069,0],[-.08,.068,.071,-.005],
    [-.17,.060,.064,-.014],[-.235,.055,.059,-.021],
  ],coat,'rider.forearm',26));
  elbow.add(shapedTorso([
    [-.22,.059,.067,-.021],[-.258,.057,.065,-.022],
  ],trim,'rider.cuff',9));
  elbow.add(shapedTorso([
    [-.253,.052,.054,-.022],[-.31,.052,.053,-.024],
    [-.359,.028,.040,-.027],
  ],skin,'rider.hand',17));
  arm.add(elbow);
  parent.add(arm);
  return arm;
}

function createRiderLeg(
  parent:THREE.Group,side:-1|1,
  cloth:THREE.Material,boot:THREE.Material,trim:THREE.Material,
):THREE.Group {
  const leg=new THREE.Group();
  leg.name=side<0?'rider.leftLeg':'rider.rightLeg';
  leg.position.set(side*.151,.66,.035);
  leg.add(shapedTorso([
    [.01,.096,.111,.02],[-.14,.109,.116,.04],
    [-.27,.096,.105,.044],[-.355,.083,.093,.034],
  ],cloth,'rider.trousers',32));
  // The true knee hinge solves the straight-legged mounted silhouette. Its
  // overlapping cloth cuff hides the joint when walking or bent in the saddle.
  const knee=new THREE.Group();
  knee.name=side<0?'rider.leftKnee':'rider.rightKnee';
  knee.position.set(0,-.33,.033);
  knee.add(shapedTorso([
    [.015,.082,.093,0],[-.075,.084,.094,-.005],
    [-.17,.073,.083,-.016],[-.226,.069,.077,-.020],
  ],cloth,'rider.shin',26));
  const ankle=new THREE.Group();
  ankle.name=side<0?'rider.leftAnkle':'rider.rightAnkle';
  ankle.position.set(0,-.175,-.018);
  ankle.add(shapedTorso([
    [.01,.071,.077,0],[-.06,.076,.085,-.014],
    [-.12,.077,.105,-.058],[-.152,.054,.080,-.074],
  ],boot,'rider.boot',24));
  ankle.add(shapedTorso([
    [-.015,.076,.081,-.008],[-.033,.075,.080,-.010],
  ],trim,'rider.boot-hem',8));
  knee.add(ankle);
  leg.add(knee);
  parent.add(leg);
  return leg;
}

/** Build original render geometry and standardized existing animation pivots. */
export function makeScalebornRider():THREE.Group {
  const group=new THREE.Group();
  group.name='character.rider.hero';
  group.userData.assetId='character.rider.hero';
  group.userData.scalebornDesign='scaleborn.hero.design.v1';

  const warmSkin=material(0xbc947e,.86);
  const shadowSkin=material(0x987d7a,.89);
  const cloakMat=woven(0x453d5f,.95);
  cloakMat.side=THREE.DoubleSide;
  const coat=woven(0x68536a,.90);
  const cloth=woven(0x3b6471,.94);
  const boot=material(0x302d3e,.93);
  const trim=new THREE.MeshStandardMaterial({
    color:0xb4a585,roughness:.76,metalness:.08,
  });
  const eyes=material(0xadb7af,.68);
  const irises=material(0x4d9a83,.57);
  const hair=material(0x252937,.93);
  const scale=new THREE.MeshStandardMaterial({
    color:0x354d67,metalness:.19,roughness:.52,
  });

  group.add(shapedTorso([
    [.56,.160,.126,.02],[.72,.168,.139,.005],
    [.89,.179,.135,-.005],[1.055,.204,.141,-.008],
    [1.16,.13,.106,-.02],
  ],coat,'rider.fitted-coat'));

  group.add(shapedTorso([
    [1.145,.063,.073,-.01],[1.19,.071,.075,-.018],
    [1.225,.075,.08,-.02],
  ],warmSkin,'rider.neck',12));

  group.add(shapedTorso([
    [1.20,.097,.095,-.005],[1.24,.136,.124,-.018],
    [1.30,.173,.151,-.011],[1.352,.169,.156,.003],
    [1.414,.149,.142,.019],[1.458,.116,.115,.035],
    [1.48,.074,.082,.038],
  ],warmSkin,'rider.face',48,30,'face'));

  // Hood-like angular hairline, parting in the middle to reveal the brows.
  group.add(shapedTorso([
    [1.40,.169,.142,.034],[1.46,.172,.149,.048],
    [1.50,.126,.123,.052],[1.525,.036,.059,.051],
  ],hair,'rider.crown',18));
  for(const side of [-1,1] as const){
    smallEye(group,side,shadowSkin,eyes,irises);
    group.add(new THREE.Mesh(taperedSpine([
      [side*.112,1.462,.032],[side*.151,1.39,.053],
      [side*.158,1.298,.069],
    ],.055),hair));
    // Dragon ancestry is subtle: swept short horns, not adult antlers.
    const horn=new THREE.Mesh(taperedSpine([
      [side*.108,1.471,.071],[side*.137,1.516,.135],
      [side*.185,1.517,.210],[side*.212,1.487,.274],
    ],.039,14),scale);
    horn.name=side<0?'rider.horn.left':'rider.horn.right';
    group.add(horn);
    // The previous side tusks looked like stray ears in real screenshots.
    // Small scales now lie along her cheek/temple, inside the face outline.
    const smallScales=new THREE.Mesh(taperedSpine([
      [side*.148,1.332,-.052],[side*.158,1.299,-.066],
      [side*.16,1.274,-.072],
    ],.014,10),scale);
    smallScales.name=side<0?'rider.temple-scales.left':'rider.temple-scales.right';
    group.add(smallScales);
    createRiderArm(group,side,coat,warmSkin,trim);
    createRiderLeg(group,side,cloth,boot,trim);
  }

  // Subtle dragon-hybrid nose bridge keeps the painted face dimensional.
  const nose=new THREE.Mesh(taperedSpine([
    [0,1.302,-.146],[0,1.281,-.156],
    [0,1.268,-.166],[0,1.256,-.171],
  ],.015,12,24),warmSkin);
  nose.name='rider.nose';
  group.add(nose);

  // Subtle expression line follows the child heroine's lower facial contour.
  // The lip is embedded in the sculpt, not a black floating cartoon mouth.
  const mouth=new THREE.Mesh(taperedSpine([
    [-.062,1.222,-.109],[-.036,1.218,-.126],
    [0,1.216,-.136],[.036,1.218,-.126],[.062,1.222,-.109],
  ],.0055,10,28),shadowSkin);
  mouth.name='rider.mouth';
  group.add(mouth);

  // Trouser belt and coastal talisman are visible without bulky armor.
  group.add(shapedTorso([
    [.685,.178,.15,.009],[.715,.180,.150,.008],
  ],trim,'rider.belt',8));
  const pendant=new THREE.Mesh(new THREE.OctahedronGeometry(.030,1),irises);
  pendant.name='rider.bond-pendant';
  pendant.position.set(0,1.01,-.149);
  group.add(pendant);

  // Broad cloak is a double-sided, hanging cloth mesh rather than a cone.
  const positions:number[]=[],uvs:number[]=[],colors:number[]=[],indexes:number[]=[];
  const cols=16,rows=14;
  for(let row=0;row<=rows;row++) {
    const t=row/rows;
    for(let col=0;col<=cols;col++){
      const s=col/cols*2-1;
      // The mantle is pinned at both collarbones, wraps the back and falls
      // outward into a slightly scalloped weighted hem. Three-dimensional
      // diagonal drape and six shallow fabric pleats break up the old flat
      // trapezoidal sail at rider-height camera angles.
      const edge=Math.abs(s), fall=t*t;
      const crease=Math.cos(s*Math.PI*6)*fall;
      positions.push(
        s*(.215+.18*t),
        1.12-.72*t+.032*edge*edge*fall+.018*Math.cos(s*Math.PI*5)*fall*t,
        .142+.28*t+.11*Math.sin(Math.PI*t)+.065*fall
          -.055*edge*edge*t+.019*crease+.012*Math.sin(s*Math.PI*4)*t,
      );
      // The original woven albedo/normal/roughness maps were never sampled
      // on this live mesh because it had no UV attribute.
      uvs.push(col/cols*2, t*2.6);
      const pigment=1-.08*edge*edge-.055*t+.035*crease;
      colors.push(.95*pigment,.92*pigment,pigment);
      if(row<rows&&col<cols){
        const k=row*(cols+1)+col,l=k+cols+1;
        indexes.push(k,k+1,l,l,k+1,l+1);
      }
    }
  }
  const cloakGeo=new THREE.BufferGeometry();
  cloakGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  cloakGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  cloakGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  cloakGeo.setIndex(indexes);cloakGeo.computeVertexNormals();
  // Dynamic cloth keeps a conservative local bound throughout banking and
  // flight; frustum culling must not clip its displaced scalloped hem.
  cloakGeo.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.75,.41),1.25);
  const cloakFabric=cloakMat.clone();
  cloakFabric.vertexColors=true;
  const cloak=new THREE.Mesh(cloakGeo,cloakFabric);
  cloak.name='rider.travel-cloak';
  group.add(cloak);

  const tail=new THREE.Group();
  tail.name='rider.tail';
  tail.position.set(0,.71,.11);
  tail.add(new THREE.Mesh(taperedSpine([
    [0,0,0],[0,-.13,.19],[0,-.24,.44],
    [.09,-.21,.68],[.08,-.16,.92],
  ],.092,12),scale));
  tail.add(sculptFin([.08,-.16,.82],[.15,-.10,1.08],
    .19,cloakMat,'rider.tail-tip'));
  group.add(tail);
  return group;
}
