// Reproducible healing card layout using the approved frame and existing illustrations.
// Run: npm run cards:render -- --group=healing [--card=slug] [--install]
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import { outputDirectory, projectRoot, installCard, fontFile } from '../runtime.mjs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const dir=fileURLToPath(new URL('.',import.meta.url));
const out=await outputDirectory('healing');
const allCards=JSON.parse(await readFile(dir+'cards.json','utf8'));
const selectedSlug=process.argv.find(arg=>arg.startsWith('--card='))?.slice(7);
if(selectedSlug&&!allCards.some(card=>card.slug===selectedSlug))throw Error('Unknown card '+selectedSlug);
const cards=allCards.filter(card=>!selectedSlug||card.slug===selectedSlug);
const width=1075,height=1463;
const {data:original}=await sharp(dir+'assets/approved-bandage.png').removeAlpha().raw().toBuffer({resolveWithObject:true});
const clean=Buffer.from(original);
const offset=(x,y)=>(y*width+x)*3;
function eraseText(x0,y0,x1,y1,predicate,sample){
  const mask=new Map();
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const i=offset(x,y);if(!predicate(original[i],original[i+1],original[i+2]))continue;
    for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){
      const d=Math.hypot(dx,dy);if(d>=5)continue;
      const key=(y+dy)*width+x+dx;
      mask.set(key,Math.max(mask.get(key)||0,Math.min(1,(5-d)/2)));
    }
  }
  for(const [key,a] of mask){const y=Math.floor(key/width),x=key%width,[sx,sy]=sample(x,y),i=key*3,j=offset(sx,sy);for(let c=0;c<3;c++)clean[i+c]=Math.round(original[i+c]*(1-a)+original[j+c]*a);}
}
const ivory=(r,g,b)=>r>155&&g>145&&b>110;
const ink=(r,g,b)=>Math.max(r,g,b)<150;
// Clear the complete title and statistic fields using nearby green texture.
for(let y=91;y<=179;y++)for(let x=237;x<=797;x++){
  const i=offset(x,y),j=offset(600+Math.floor((x-237)*170/560),185+Math.floor((y-91)*30/88));
  const a=Math.min(1,(x-237)/7,(797-x)/7,(y-91)/7,(179-y)/7);
  for(let c=0;c<3;c++)clean[i+c]=Math.round(original[i+c]*(1-a)+original[j+c]*a);
}
eraseText(826,95,980,213,ivory,(x,y)=>[x,216]);
eraseText(100,935,975,1045,ink,(x,y)=>[x,1055+Math.floor((y-935)*0.4)]);
eraseText(100,1168,975,1232,ink,(x,y)=>[x,y-100]);
// Darken only the charcoal outside the chamfered green frame. Retain its grain
// while giving the physical card edge more contrast against the game table.
const frameOutline=[[49,101],[100,52],[978,52],[1026,101],[1026,1358],[979,1412],[102,1412],[49,1358]];
function insideFrame(x,y){
  let inside=false;
  for(let i=0,j=frameOutline.length-1;i<frameOutline.length;j=i++){
    const [xi,yi]=frameOutline[i],[xj,yj]=frameOutline[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(!insideFrame(x,y)){
  const i=offset(x,y);for(let c=0;c<3;c++)clean[i+c]=Math.round(clean[i+c]*0.45);
}
const base=await sharp(clean,{raw:{width,height,channels:3}}).png().toBuffer();
await writeFile(out+'blank-text-frame.png',base);
const artWidth=940,artHeight=632,artLeft=68,artTop=247;
const artMask=Buffer.from(`<svg width="940" height="632"><path fill="white" d="M40 0H900L940 40V592L900 632H490L470 617L450 632H40L0 592V40Z"/></svg>`);
const background=await sharp(dir+'assets/green-smoke.png').resize(artWidth,artHeight,{fit:'cover'}).png().toBuffer();
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
async function lettering(text,font,size,color,maxWidth,wrap=false){
  const options={text:`<span foreground="${color}">${escape(text)}</span>`,font:`${font} ${size}`,fontfile:fontFile(font),rgba:true,dpi:72};
  if(wrap){options.width=maxWidth;options.wrap='word';options.spacing=7;}
  let image=sharp({text:options});let buffer=await image.png().toBuffer(),meta=await sharp(buffer).metadata();
  if(!wrap&&meta.width>maxWidth){buffer=await sharp(buffer).resize(maxWidth,meta.height,{fit:'fill'}).png().toBuffer();meta=await sharp(buffer).metadata();}
  return {buffer,width:meta.width,height:meta.height};
}
for(const sub of ['originals','trimmed-300dpi','bleed-300dpi','previous-public'])await mkdir(out+sub,{recursive:true});
const manifest=[];
for(const card of cards){
  // Alpha-bearing cutouts retain their original illustration details.
  const cutout=await sharp(dir+'assets/'+card.slug+'.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Remove transparent padding when fitting the existing art to its panel.
  let left=cutout.info.width,top=cutout.info.height,right=0,bottom=0;
  for(let y=0;y<cutout.info.height;y++)for(let x=0;x<cutout.info.width;x++)if(cutout.data[(y*cutout.info.width+x)*4+3]>8){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  left=Math.max(0,left-12);top=Math.max(0,top-12);
  right=Math.min(cutout.info.width-1,right+12);bottom=Math.min(cutout.info.height-1,bottom+12);
  const art=await sharp(cutout.data,{raw:{width:cutout.info.width,height:cutout.info.height,channels:4}}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize({width:870,height:570,fit:'inside'}).png().toBuffer();
  const artMeta=await sharp(art).metadata();
  const panel=await sharp(background).composite([{input:art,left:Math.round((artWidth-artMeta.width)/2),top:Math.round((artHeight-artMeta.height)/2)}]).png().toBuffer();
  const clipped=await sharp(panel).ensureAlpha().composite([{input:artMask,blend:'dest-in'}]).png().toBuffer();
  const title=await lettering(card.name.toUpperCase(),'Noto Sans Black',82,'#f4ecd5',548);
  const stat=await lettering(card.stat,'DejaVu Sans Bold',92,'#f4ecd5',150);
  const statLabel=await lettering(card.statLabel,'Noto Sans Condensed Bold',30,'#f4ecd5',158);
  let bodySize=46,body=await lettering(card.rules,'Liberation Serif Bold',bodySize,'#171611',854,true);
  while(body.height>186&&bodySize>38)body=await lettering(card.rules,'Liberation Serif Bold',--bodySize,'#171611',854,true);
  if(body.height>186)throw new Error(`${card.slug}: rules do not fit`);
  const quip=await lettering(card.quip,'Liberation Serif Bold Italic',42,'#171611',854);
  const overlays=[{input:clipped,left:artLeft,top:artTop},
    {input:title.buffer,left:248,top:108},
    {input:stat.buffer,left:Math.round(901-stat.width/2),top:Math.round(135-stat.height/2)},
    {input:statLabel.buffer,left:Math.round(901-statLabel.width/2),top:183},
    {input:body.buffer,left:110,top:934},
    {input:quip.buffer,left:Math.round((width-quip.width)/2),top:1184}];
  const originalPath='originals/'+card.slug+'.png';
  await sharp(base).composite(overlays).png().toFile(out+originalPath);
  // The original is a complete face, including its intended charcoal margin.
  // Fit it inside the TRIM canvas first. A small extra inset keeps the colored
  // frame inside the 1/8-inch safe zone. Extend only background beyond trim.
  // The double-size intermediate supports exact 75px = 1/8-inch bleed edges;
  // it does not imply the generated source has native 600-DPI detail.
  const face=await sharp(out+originalPath).resize(1480,2072,{fit:'fill'}).png().toBuffer();
  const trimCanvas=await sharp(face).extend({left:10,right:10,top:14,bottom:14,extendWith:'mirror'}).png().toBuffer();
  const working=await sharp(trimCanvas).extend({left:75,right:75,top:75,bottom:75,extendWith:'mirror'}).png().toBuffer();
  const bleed='bleed-300dpi/'+card.slug+'.png',trimmed='trimmed-300dpi/'+card.slug+'.png';
  await sharp(working).resize(825,1125).withMetadata({density:300}).png().toFile(out+bleed);
  await sharp(trimCanvas).resize(750,1050).withMetadata({density:300}).png().toFile(out+trimmed);
  for(const [file,w,h] of [[bleed,825,1125],[trimmed,750,1050]]){const m=await sharp(out+file).metadata();if(m.width!==w||m.height!==h||m.density!==300)throw new Error('Invalid export '+file);}
  const publicPath=resolve(projectRoot,'public/cards/fronts/healing/ai-review/final/'+card.slug+'-dark-01.png');
  if(process.argv.includes('--install'))await installCard(out+trimmed,publicPath,out+'previous-public/'+card.slug+'.png');
  manifest.push({...card,original:originalPath,trimmed,bleed,bodyFontPixels:bodySize,bodyHeight:body.height,quipWidth:quip.width,publicPath});
}
await writeFile(out+'manifest.json',JSON.stringify({trim:{inches:[2.5,3.5],pixels:[750,1050],dpi:300},bleed:{inches:[2.75,3.75],pixels:[825,1125],dpi:300,inchesPerEdge:0.125},safeArea:{insetFromTrimInches:0.125,insetFromTrimPixels:37.5,inches:[2.25,3.25]},exportProcess:'Preserve the full face inside trim; extend charcoal background outward for bleed.',colorSpace:'sRGB',method:'Shared frame, selected healing illustrations, green-tinted smoke, deterministic typesetting',cards:manifest},null,2)+'\n');
console.log(`Rendered ${cards.length} healing cards${process.argv.includes('--install')?' and installed game images':''}.`);
