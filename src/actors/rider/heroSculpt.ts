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
  const rising=profile[profile.length-1]![0]>=profile[0]![0];
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

function smallEye(parent:THREE.Group,side:number,
  skin:THREE.Material,eye:THREE.Material,iris:THREE.Material):void {
  // Small almond-shaped eyes sit against the facial surface rather than
  // floating as round green toy-like globes in real close-up screenshots.
  const white = new THREE.Mesh(new THREE.SphereGeometry(1,18,14),eye);
  white.name=side<0?'rider.eye.left':'rider.eye.right';
  white.position.set(side*.118,1.295,-.153);
  white.scale.set(.038,.018,.0065);
  parent.add(white);
  const jewel=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),iris);
  jewel.name=side<0?'rider.iris.left':'rider.iris.right';
  jewel.position.set(side*.118,1.295,-.161);
  jewel.scale.set(.012,.014,.0045);
  parent.add(jewel);
  // Curved upper and lower eyelids partially enclose the thin almond eye.
  // They hide the exposed sphere edges that appeared googly in real WebGL QA.
  const upperLid = new THREE.Mesh(taperedSpine([
    [side*.077,1.309,-.157],[side*.112,1.320,-.161],
    [side*.151,1.306,-.153],
  ],.011,10,20),skin);
  upperLid.name=side<0?'rider.eyelid.upper.left':'rider.eyelid.upper.right';
  parent.add(upperLid);
  const lowerLid = new THREE.Mesh(taperedSpine([
    [side*.079,1.280,-.156],[side*.112,1.277,-.159],
    [side*.150,1.285,-.151],
  ],.008,10,20),skin);
  lowerLid.name=side<0?'rider.eyelid.lower.left':'rider.eyelid.lower.right';
  parent.add(lowerLid);
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
  arm.position.set(side*.255,1.107,-.018);
  const sleeve=shapedTorso([
    [.025,.072,.082,0],[0,.083,.092,-.008],
    [-.11,.099,.104,-.025],[-.21,.085,.096,-.040],
    [-.37,.072,.081,-.067],[-.52,.067,.074,-.085],
  ],coat,'rider.sleeve');
  arm.add(sleeve);
  const cuff=shapedTorso([
    [-.48,.073,.079,-.08],[-.54,.071,.078,-.08],
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
    [0,.107,.127,.02],[-.18,.116,.124,.05],
    [-.35,.087,.101,.035],[-.47,.079,.087,.028],
  ],cloth,'rider.trousers');
  leg.add(trousers);
  const shoe=shapedTorso([
    [-.41,.086,.097,.034],[-.54,.086,.104,-.018],
    [-.61,.093,.13,-.07],[-.64,.064,.105,-.08],
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
      [side*.102,1.474,.056],[side*.143,1.526,.111],
      [side*.173,1.568,.173],
    ],.052,12),scale);
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

  // Subtle dragon-hybrid nose bridge keeps the painted face dimensional.
  const nose=new THREE.Mesh(taperedSpine([
    [0,1.297,-.151],[0,1.266,-.176],[0,1.245,-.174],
  ],.026,10,18),warmSkin);
  nose.name='rider.nose';
  group.add(nose);

  // Trouser belt and coastal talisman are visible without bulky armor.
  group.add(shapedTorso([
    [.685,.178,.15,.009],[.715,.180,.150,.008],
  ],trim,'rider.belt',8));
  const pendant=new THREE.Mesh(new THREE.OctahedronGeometry(.030,1),irises);
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
