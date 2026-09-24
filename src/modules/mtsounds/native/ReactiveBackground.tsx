"use client";

import { useEffect, useRef } from "react";

export default function ReactiveBackground(){
  const ref=useRef<HTMLCanvasElement>(null);

  useEffect(()=>{
    const canvas=ref.current;
    if(!canvas)return;
    const ctx=canvas.getContext("2d");
    if(!ctx)return;

    let raf=0,w=0,h=0,dpr=1;
    const mouse={x:.5,y:.4,tx:.5,ty:.4};

    const resize=()=>{
      dpr=Math.min(2,window.devicePixelRatio||1);
      w=window.innerWidth;h=window.innerHeight;
      canvas.width=Math.floor(w*dpr);
      canvas.height=Math.floor(h*dpr);
      canvas.style.width=w+"px";
      canvas.style.height=h+"px";
      ctx.setTransform(dpr,0,0,dpr,0,0);
    };
    const onMove=(e:PointerEvent)=>{
      mouse.tx=e.clientX/Math.max(1,w);
      mouse.ty=e.clientY/Math.max(1,h);
    };
    const draw=()=>{
      mouse.x+=(mouse.tx-mouse.x)*.06;
      mouse.y+=(mouse.ty-mouse.y)*.06;
      ctx.clearRect(0,0,w,h);
      const mx=mouse.x*w,my=mouse.y*h;
      const spacing=Math.max(42,Math.min(66,w/22));

      const glow=ctx.createRadialGradient(mx,my,0,mx,my,Math.min(w,h)*.55);
      glow.addColorStop(0,"rgba(181,55,255,.16)");
      glow.addColorStop(.32,"rgba(122,36,255,.07)");
      glow.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);

      ctx.lineWidth=1;
      for(let x=-spacing;x<w+spacing;x+=spacing){
        ctx.beginPath();
        for(let y=-spacing;y<h+spacing;y+=14){
          const dx=x-mx,dy=y-my,dist=Math.sqrt(dx*dx+dy*dy);
          const force=Math.max(0,1-dist/320);
          const px=x+force*(dx/Math.max(1,dist))*24+(mouse.x-.5)*8;
          const py=y+force*(dy/Math.max(1,dist))*8;
          if(y===-spacing)ctx.moveTo(px,py);else ctx.lineTo(px,py);
        }
        ctx.strokeStyle="rgba(255,255,255,.045)";ctx.stroke();
      }
      for(let y=-spacing;y<h+spacing;y+=spacing){
        ctx.beginPath();
        for(let x=-spacing;x<w+spacing;x+=14){
          const dx=x-mx,dy=y-my,dist=Math.sqrt(dx*dx+dy*dy);
          const force=Math.max(0,1-dist/340);
          const px=x+force*(dx/Math.max(1,dist))*8;
          const py=y+force*(dy/Math.max(1,dist))*24+(mouse.y-.5)*6;
          if(x===-spacing)ctx.moveTo(px,py);else ctx.lineTo(px,py);
        }
        ctx.strokeStyle="rgba(165,69,255,.075)";ctx.stroke();
      }
      const dotGap=spacing*2;
      for(let x=0;x<w;x+=dotGap){
        for(let y=0;y<h;y+=dotGap){
          const dx=x-mx,dy=y-my,dist=Math.sqrt(dx*dx+dy*dy);
          if(dist<260){
            ctx.beginPath();ctx.arc(x,y,1.2+(1-dist/260)*2.3,0,Math.PI*2);
            ctx.fillStyle="rgba(221,151,255,"+(0.08+(1-dist/260)*.34)+")";ctx.fill();
          }
        }
      }
      raf=requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize",resize);
    window.addEventListener("pointermove",onMove,{passive:true});
    raf=requestAnimationFrame(draw);
    return()=>{
      cancelAnimationFrame(raf);
      window.removeEventListener("resize",resize);
      window.removeEventListener("pointermove",onMove);
    };
  },[]);

  return <canvas ref={ref} className="mts-reactive-bg" aria-hidden="true"/>;
}
