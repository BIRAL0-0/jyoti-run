import fs from 'node:fs';
import { PNG } from 'pngjs';
for (const f of process.argv.slice(2)) {
  const {width:W,height:H,data}=PNG.sync.read(fs.readFileSync(f));
  console.log(`\n=== ${f}  ${W}×${H}`);
  // opaque bbox
  let minX=W,minY=H,maxX=-1,maxY=-1,op=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;
    if(data[i+3]>200){op++;if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}}
  console.log('opaque',(op/(W*H)*100).toFixed(1)+'%','bbox',JSON.stringify({x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}));
  // vertical colour profile (8 bands) over OPAQUE pixels only
  for(let b=0;b<8;b++){
    let r=0,g=0,bl=0,n=0;
    for(let y=Math.floor(b*H/8);y<Math.floor((b+1)*H/8);y++)
      for(let x=0;x<W;x++){const i=(y*W+x)*4;if(data[i+3]>200){r+=data[i];g+=data[i+1];bl+=data[i+2];n++;}}
    if(n) console.log(` band${b} y=${String(Math.floor(b*H/8)).padStart(4)} rgb(${(r/n).toFixed(0)},${(g/n).toFixed(0)},${(bl/n).toFixed(0)})`);
  }
  // horizontal colour profile (6 bands)
  for(let b=0;b<6;b++){
    let r=0,g=0,bl=0,n=0;
    for(let x=Math.floor(b*W/6);x<Math.floor((b+1)*W/6);x++)
      for(let y=0;y<H;y++){const i=(y*W+x)*4;if(data[i+3]>200){r+=data[i];g+=data[i+1];bl+=data[i+2];n++;}}
    if(n) console.log(` col${b} x=${String(Math.floor(b*W/6)).padStart(4)} rgb(${(r/n).toFixed(0)},${(g/n).toFixed(0)},${(bl/n).toFixed(0)})`);
  }
}
