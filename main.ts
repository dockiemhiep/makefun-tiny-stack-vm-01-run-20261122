import*as f from'fs'
import{join as j}from'path'
let{MAKEFUN_INPUT_DIR:x='/input',MAKEFUN_OUTPUT_DIR:y='/output'}=process.env
for(let k of f.readdirSync(x).sort()){
let v=j(y,k),r=n=>f.readFileSync(j(x,k,n+'.bin')),w=(n,d)=>f.writeFileSync(j(v,n),d)
let P=r('program'),I=r('input'),O=Buffer.alloc(65536),d=new Int32Array(576)
let s=0,p=0,c=512,l=0,t=0,e=-1,a,b,U=()=>P.readUInt16LE(p-2),J=()=>p+=U()<<16>>16
let H=[
['AbeIiQqY',()=>e=0,()=>P.readInt8(p-1),()=>P.readInt32LE(p-4),()=>s--,()=>b,()=>(d[s-2]=b,d[s-1]=a),()=>a,()=>(d[s-1]=d[s-3],d[s-3]=a,d[s-2]=b)],
['1111111)111)111',()=>a+b,()=>a-b,()=>Math.imul(a,b),()=>a/b,()=>a%b,()=>(a>>>0)/(b>>>0),()=>(a>>>0)%(b>>>0),()=>-b,()=>a&b,()=>a|b,()=>a^b,()=>~b,()=>a<<b,()=>a>>b,()=>a>>>b],
['111',()=>a==b,()=>a<b,()=>a>>>0<b>>>0],
['CKKCA',J,()=>!d[--s]&&J(),()=>d[--s]&&J(),()=>c<576?(d[c++]=p,p=U()):e=7,()=>c>512?p=d[--c]:e=8],
['IQ',()=>b>>>8?e=6:d[s-1]=d[256+b],()=>b>>>8?e=6:(d[256+b]=a,s-=2)],
['IIaI',()=>{let z=''+b;l+z.length>65536?e=11:(l+=O.write(z,l),s--)},()=>l==65536?e=11:O[l++]=d[--s],()=>I[t++]??-1,()=>e=b&255]
]
for(let g=1e6;g--&&e<0;){
if(p>>>0>=P.length){e=9;break}
let o=P[p],h=H[o>>4],k=o&15,v=h?.[0].charCodeAt(k),w=v&7,n=v>>3&3
e=!w?5:(p+=w)>P.length?9:s<n?2:v>95&&s==256?3:-1
if(e>=0)break
a=d[s-2];b=d[s-1]
if(o>18&&o<23&&!b)e=4
else if(v&32)d[s-=v<64?n:0,s++]=h[k+1]()
else h[k+1]()
}
f.mkdirSync(v,{recursive:true})
w('stdout.bin',O.subarray(0,l))
w('exit.txt',''+(e<0?10:e))
}
