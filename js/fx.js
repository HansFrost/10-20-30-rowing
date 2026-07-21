function confettiBurst(){
  const colors=['#B7BF10','#f59e0b','#22c55e','#ef4444','#60a5fa','#e879f9'];
  let box=document.getElementById('confettiBox');
  if(box)box.remove();
  box=document.createElement('div');box.id='confettiBox';document.body.appendChild(box);
  for(let i=0;i<70;i++){
    const b=document.createElement('div');
    b.className='confetti-bit';
    b.style.left=(Math.random()*100)+'vw';
    b.style.background=colors[i%colors.length];
    b.style.animationDuration=(1.8+Math.random()*1.6)+'s';
    b.style.animationDelay=(Math.random()*.6)+'s';
    box.appendChild(b);
  }
  setTimeout(()=>box.remove(),4200);
}
export{confettiBurst};
