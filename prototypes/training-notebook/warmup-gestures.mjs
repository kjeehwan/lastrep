// Shared swipe/keyboard deletion behavior for both warm-up-sheet hosts.
export function installWarmupGestures(stage, { selector, read, render, rowAttribute, deleteSelector }) {
  let pointer=null, suppressUntil=0;
  stage.addEventListener('dragstart',event=>{if(event.target.closest(selector))event.preventDefault();});
  stage.addEventListener('pointerdown',event=>{
    const row=event.target.closest(selector);if(!row||event.button!==0||!read())return;
    const index=Number(row.getAttribute(rowAttribute));pointer={row,index,id:event.pointerId,x:event.clientX,y:event.clientY,dragging:false,offset:read().swiped===index?-88:0};
  });
  stage.addEventListener('pointermove',event=>{
    const g=pointer;if(!g||g.id!==event.pointerId)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;
    if(!g.dragging&&Math.abs(dy)>12&&Math.abs(dy)>=Math.abs(dx)){pointer=null;return;}
    if(!g.dragging&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)){g.dragging=true;g.row.setPointerCapture(event.pointerId);}
    if(!g.dragging)return;if(event.cancelable)event.preventDefault();g.row.style.transition='none';g.row.style.transform=`translateX(${Math.max(-88,Math.min(0,g.offset+dx))}px)`;
  });
  stage.addEventListener('pointerup',event=>{
    const g=pointer;pointer=null;if(!g||g.id!==event.pointerId||!g.dragging||!read())return;
    read().swiped=g.offset+event.clientX-g.x < -40?g.index:null;suppressUntil=performance.now()+200;render();
  });
  stage.addEventListener('pointercancel',()=>{if(pointer?.dragging){pointer.row.style.removeProperty('transition');pointer.row.style.removeProperty('transform');}pointer=null;});
  stage.addEventListener('keydown',event=>{
    if(!event.target.matches(selector)||!['ArrowLeft','ArrowRight'].includes(event.key)||!read())return;
    event.preventDefault();event.stopPropagation();const index=Number(event.target.getAttribute(rowAttribute));read().swiped=event.key==='ArrowLeft'?index:null;render();
    const target=event.key==='ArrowLeft'?`${deleteSelector}[data-index="${index}"]`:`${selector}[${rowAttribute}="${index}"]`;stage.querySelector(target)?.focus({preventScroll:true});
  });
  stage.addEventListener('click',event=>{if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
}
