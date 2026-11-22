import * as THREE from 'three';
import { taperedSpine, sculptFin } from '../dragon/organicSculpt';

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
  samples=36, radial=24,
):THREE.Mesh {
  const positions:number[]=[], uvs:number[]=[], index:number[]=[];
  for(let i=0;i<=samples;i++){
    const t=i/samples;
    const f=t*(profile.length-1), k=Math.min(profile.length-2,Math.floor(f));
    const u=f-k, ease=u*u*(3-2*u);
    const a=profile[k]!, b=profile[k+1]!;
    const lerp=(channel:number):number=>a[channel]!+(b[channel]!-a[channel]!)*ease;
    for(let j=0;j<=radial;j++){
      const angle=j/radial*Math.PI*2;
      const r=.004*Math.sin(angle*7+t*19);
      positions.push(Math.cos(angle)*(lerp(1)+r),
        lerp(0), lerp(3)+Math.sin(angle)*(lerp(2)+r));
      uvs.push(j/radial,t);
      if(i<samples&&j<radial) {
        const base=i*(radial+1)+j,next=base+radial+1;
        index.push(base,base+1,next,base+1,next+1,next);
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

function smallEye(parent:THREE.Group,side:number,
  skin:THREE.Material,eye:THREE.Material,iris:THREE.Material):void {
  const white = new THREE.Mesh(new THREE.SphereGeometry(1,18,14),eye);
  white.position.set(side*.118,1.295,-.173);
  white.scale.set(.052,.039,.019);
  parent.add(white);
  const jewel=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),iris);
  jewel.position.set(side*.120,1.296,-.193);
  jewel.scale.set(.023,.032,.013);
  parent.add(jewel);
  const brow=new THREE.Mesh(taperedSpine([
    [side*.060,1.357,-.172],[side*.110,1.366,-.192],
    [side*.165,1.347,-.164],
  ],.018,8),skin);
  brow.name=side<0?'rider.brow.left':'rider.brow.right';
  parent.add(brow);
}

function createRiderArm(
  parent:THREE.Group,side:-1|1,
  coat:THREE.Material,skin:THREE.Material,trim:THREE.Material,
):THREE.Group{
  const arm=new THREE.Group();
  arm.name=side<0?'rider.leftArm':'rider.rightArm';
  arm.position.set(side*.285,1.107,-.018);
  const sleeve=shapedTorso([
    [.01,.102,.104,0],[-.12,.122,.124,-.024],
    [-.34,.093,.092,-.066],[-.52,.077,.083,-.085],
  ],coat,'rider.sleeve');
  arm.add(sleeve);
  const cuff=shapedTorso([
    [-.48,.084,.091,-.08],[-.54,.08,.09,-.08],
  ],trim,'rider.cuff',8);
  arm.add(cuff);
  const hand=shapedTorso([
    [-.54,.055,.067,-.085],[-.64,.07,.068,-.08],
    [-.70,.031,.046,-.079],
  ],skin,'rider.hand',14);
  arm.add(hand);
  parent.add(arm);return arm;
}

function createRiderLeg(
  parent:THREE.Group,side:-1|1,
  cloth:THREE.Material,boot:THREE.Material,trim:THREE.Material,
):THREE.Group {
  const leg=new THREE.Group();
  leg.name=side<0?'rider.leftLeg':'rider.rightLeg';
  leg.position.set(side*.155,.66,.035);
  const trousers=shapedTorso([
    [0,.112,.132,.02],[-.18,.126,.132,.05],
    [-.35,.090,.106,.035],[-.47,.082,.092,.028],
  ],cloth,'rider.trousers');
  leg.add(trousers);
  const shoe=shapedTorso([
    [-.41,.09,.10,.034],[-.54,.094,.11,-.018],
    [-.61,.11,.16,-.07],[-.64,.07,.12,-.08],
  ],boot,'rider.boot');
  leg.add(shoe);
  const ankle=new THREE.Mesh(taperedSpine([
    [0,-.49,.055],[0,-.48,.058],[0,-.47,.064],
  ],.101,14,8),trim);
  leg.add(ankle);
  parent.add(leg);return leg;
}

/** Build original render geometry and standardized existing animation pivots. */
export function makeScalebornRider():THREE.Group {
  const group=new THREE.Group();
  group.name='character.rider.hero';
  group.userData.assetId='character.rider.hero';
  group.userData.scalebornDesign='scaleborn.hero.design.v1';

  const warmSkin=material(0xbc947e,.86);
  const shadowSkin=material(0x987d7a,.89);
  const cloakMat=new THREE.MeshStandardMaterial({
    color:0x453d5f,roughness:.95,side:THREE.DoubleSide,
  });
  const coat=material(0x68536a,.88);
  const cloth=material(0x3b6471,.94);
  const boot=material(0x302d3e,.93);
  const trim=new THREE.MeshStandardMaterial({
    color:0xb4a585,roughness:.76,metalness:.08,
  });
  const eyes=material(0xc2c9bf,.4);
  const irises=material(0x6ec8aa,.32);
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
    [1.20,.104,.101,-.005],[1.24,.171,.139,-.018],
    [1.33,.173,.156,-.005],[1.42,.147,.143,.019],
    [1.48,.091,.108,.035],
  ],warmSkin,'rider.face',42));

  // Hood-like angular hairline, parting in the middle to reveal the brows.
  group.add(shapedTorso([
    [1.40,.169,.142,.034],[1.46,.172,.149,.048],
    [1.50,.126,.123,.052],[1.525,.036,.059,.051],
  ],hair,'rider.crown',18));
  for(const side of [-1,1] as const){
    smallEye(group,side,shadowSkin,eyes,irises);
    group.add(new THREE.Mesh(taperedSpine([
      [side*.120,1.462,.032],[side*.170,1.39,.053],
      [side*.182,1.275,.067],
    ],.055),hair));
    // Dragon ancestry is subtle: swept short horns, not adult antlers.
    const horn=new THREE.Mesh(taperedSpine([
      [side*.102,1.474,.056],[side*.145,1.545,.071],
      [side*.176,1.595,.121],
    ],.067,11),scale);
    horn.name=side<0?'rider.horn.left':'rider.horn.right';
    group.add(horn);
    const smallScales=new THREE.Mesh(taperedSpine([
      [side*.17,1.26,.01],[side*.20,1.243,-.025],
      [side*.215,1.215,-.005],
    ],.032),scale);
    group.add(smallScales);
    createRiderArm(group,side,coat,warmSkin,trim);
    createRiderLeg(group,side,cloth,boot,trim);
  }

  // Trouser belt and coastal talisman are visible without bulky armor.
  group.add(shapedTorso([
    [.685,.178,.15,.009],[.715,.180,.150,.008],
  ],trim,'rider.belt',8));
  const pendant=new THREE.Mesh(new THREE.OctahedronGeometry(.045,1),irises);
  pendant.name='rider.bond-pendant';
  pendant.position.set(0,1.01,-.149);
  group.add(pendant);

  // Broad cloak is a double-sided, hanging cloth mesh rather than a cone.
  const positions:number[]=[],indexes:number[]=[];
  const cols=16,rows=14;
  for(let row=0;row<=rows;row++) {
    const t=row/rows;
    for(let col=0;col<=cols;col++){
      const s=col/cols*2-1;
      positions.push(s*(.22+t*.32),
        1.12-t*.68+Math.sin(Math.abs(s)*3)*t*.03,
        .135+Math.sin(Math.PI*t)*.18+.07*Math.cos(s*3)*t);
      if(row<rows&&col<cols){
        const k=row*(cols+1)+col,l=k+cols+1;
        indexes.push(k,k+1,l,l,k+1,l+1);
      }
    }
  }
  const cloakGeo=new THREE.BufferGeometry();
  cloakGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  cloakGeo.setIndex(indexes);cloakGeo.computeVertexNormals();
  const cloak=new THREE.Mesh(cloakGeo,cloakMat);
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
