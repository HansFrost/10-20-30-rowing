/* <time-field>: drop-in replacement for input[type=time] that ALWAYS renders
   24h regardless of browser or OS locale (native time inputs ignore lang and
   follow the browser UI locale, so 24h cannot be forced on them).
   API mirrors the input: .value gets/sets 'HH:MM' or '', value="" attribute
   sets the initial value, data-* attributes pass through untouched. */
const HOURS=Array.from({length:24},(_,h)=>String(h).padStart(2,'0'));
const MINS=Array.from({length:12},(_,i)=>String(i*5).padStart(2,'0'));

function options(list){
  return '<option value="">--</option>'+list.map(v=>'<option>'+v+'</option>').join('');
}

class TimeField extends HTMLElement{
  connectedCallback(){
    if(this._built)return;
    this._built=true;
    this.innerHTML='<select class="tf-h" aria-label="Hour">'+options(HOURS)+'</select>'+
      '<span class="tf-c">:</span>'+
      '<select class="tf-m" aria-label="Minutes">'+options(MINS)+'</select>';
    this._h=this.querySelector('.tf-h');
    this._m=this.querySelector('.tf-m');
    this._h.addEventListener('change',()=>{if(this._h.value&&!this._m.value)this._m.value='00'});
    const initial=this.getAttribute('value');
    if(initial)this.value=initial;
  }
  _ensureMinuteOption(mm){
    if(!MINS.includes(mm)&&!this._m.querySelector('option[value="'+mm+'"]')){
      const o=document.createElement('option');o.textContent=mm;this._m.appendChild(o);
    }
  }
  get value(){
    if(!this._built)return this.getAttribute('value')||'';
    if(this._h.value==='')return '';
    return this._h.value+':'+(this._m.value||'00');
  }
  set value(v){
    if(!this._built)this.connectedCallback();
    const m=/^(\d{2}):(\d{2})/.exec(v||'');
    if(!m){this._h.value='';this._m.value='';return}
    this._ensureMinuteOption(m[2]);
    this._h.value=m[1];
    this._m.value=m[2];
  }
}
customElements.define('time-field',TimeField);
export{TimeField};
