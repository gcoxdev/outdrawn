// Reframe the approved artwork without regenerating its logo or ornament.
import sharp from 'sharp';
import { outputDirectory, projectRoot, installCard } from '../runtime.mjs';
import { resolve } from 'node:path';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const out=await outputDirectory('classic-back');
for(const sub of ['trimmed-300dpi','bleed-300dpi'])await mkdir(out+sub,{recursive:true});
const source=dir+'assets/previous-back.png';
// The artwork's frame is centered near x=369, rather than the 375px canvas
// center. Remove only surplus background to the right and below the frame.
const crop={left:0,top:0,width:738,height:1042};
const face=await sharp(source).extract(crop).resize({width:686,height:970,fit:'inside'}).png().toBuffer();
const faceMeta=await sharp(face).metadata();
const left=Math.round((750-faceMeta.width)/2),top=Math.round((1050-faceMeta.height)/2);
// Continue the existing charcoal grain into a clean print-safe margin.
const texture=await sharp(source).extract({left:200,top:180,width:300,height:200}).modulate({brightness:0.55}).removeAlpha().png().toBuffer();
const background=await sharp({create:{width:750,height:1050,channels:3,background:'#101010'}}).composite([{input:texture,tile:true}]).png().toBuffer();
const trim=await sharp(background).composite([{input:face,left,top}]).withMetadata({density:300}).png().toBuffer();
const name='outdrawn-back-dark-logo-01.png';
await writeFile(out+'trimmed-300dpi/'+name,trim);
// Work at twice output size so the 37.5px bleed is symmetric on all edges.
const bleedDouble=await sharp(trim).resize(1500,2100).extend({left:75,right:75,top:75,bottom:75,extendWith:'mirror'}).png().toBuffer();
await sharp(bleedDouble).resize(825,1125).withMetadata({density:300}).png().toFile(out+'bleed-300dpi/'+name);
if(process.argv.includes('--install'))await installCard(out+'trimmed-300dpi/'+name,resolve(projectRoot,'public/cards/backs/'+name),out+'previous-public/'+name);
await writeFile(out+'manifest.json',JSON.stringify({source:'assets/previous-back.png',method:'Crop surplus background; center and proportionally scale existing face on extended charcoal texture.',sourceCrop:crop,placedFace:{left,top,width:faceMeta.width,height:faceMeta.height},frameMarginPixelsApprox:40,trim:{inches:[2.5,3.5],pixels:[750,1050],dpi:300},bleed:{inches:[2.75,3.75],pixels:[825,1125],dpi:300,inchesPerEdge:0.125},colorSpace:'sRGB'},null,2)+'\n');
console.log({left,top,width:faceMeta.width,height:faceMeta.height});
