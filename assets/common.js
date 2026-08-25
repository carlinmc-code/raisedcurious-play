export function fitCanvas(canvas, height=520){const dpr=Math.max(1,Math.min(2,devicePixelRatio||1));const w=canvas.clientWidth||900;canvas.width=Math.round(w*dpr);canvas.height=Math.round(height*dpr);const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);return {ctx:c,w,h:height,dpr}}
export function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
export function rand(a,b){return a+Math.random()*(b-a)}
export function pointerPos(e,canvas){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*(canvas.width/(devicePixelRatio||1))/r.width,y:(e.clientY-r.top)*((canvas.height/(devicePixelRatio||1))/r.height)}}
export function shell(title,subtitle){document.title=`${title} · RaisedCurious Play`;document.querySelector('[data-title]').textContent=title;document.querySelector('[data-subtitle]').textContent=subtitle}

/* Offline. Registering from here as well as the hub means a child who
   opens a game directly still gets the site saved on their device. */
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0)
  navigator.serviceWorker.register('/sw.js?v=6db832acd82b').catch(function(){});
