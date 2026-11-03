// Small, dependency-free motion layer. No scroll/pointer rendering loops.
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const active = new Set();
const easing = 'cubic-bezier(.2,.75,.25,1)';
export function enter(elements, {distance=10, stagger=32, duration=380}={}) {
  if (preference.matches || document.hidden) return;
  [...elements].filter(el => el.getClientRects().length).slice(0,16).forEach((el,i) => {
    if (!el.animate) return;
    const animation = el.animate([
      {opacity:0, transform:`translateY(${distance}px)`},
      {opacity:1, transform:'translateY(0)'}
    ], {duration, delay:Math.min(i*stagger,180), easing, fill:'backwards'});
    active.add(animation);
    animation.finished.catch(()=>{}).finally(()=>active.delete(animation));
  });
}
function cancelMotion(){active.forEach(a=>a.cancel());active.clear();}
preference.addEventListener('change',()=>{if(preference.matches)cancelMotion();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelMotion();});
export function initMotion(){
  enter(document.querySelectorAll('.hero .eyebrow,.hero h1,.hero p,.data-sync-status .sync-pill'),{stagger:62,distance:10,duration:510});
  if (!('IntersectionObserver' in window)) return;
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      enter([entry.target],{distance:12,duration:460});
      observer.unobserve(entry.target);
    });
  },{threshold:.08});
  document.querySelectorAll('#historico,#embreve,.future-grid .future,.about-placeholder').forEach(el=>observer.observe(el));
}
