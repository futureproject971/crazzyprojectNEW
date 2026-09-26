"use client";
type PromptOptions={label:string;defaultValue?:string;placeholder?:string;confirmLabel?:string;inputMode?:"text"|"decimal"|"numeric";required?:boolean};
function mount(title:string,body:(close:(value:string|null)=>void)=>HTMLElement){
 const previous=document.activeElement as HTMLElement|null;
 const backdrop=document.createElement("div");backdrop.className="crz-action-dialog-backdrop";
 const card=document.createElement("section");card.className="crz-action-dialog";card.setAttribute("role","dialog");card.setAttribute("aria-modal","true");
 const heading=document.createElement("h2");heading.id="crz-dialog-"+crypto.randomUUID();heading.textContent=title;card.setAttribute("aria-labelledby",heading.id);card.appendChild(heading);
 const host=document.createElement("div");card.appendChild(host);backdrop.appendChild(card);document.body.appendChild(backdrop);
 let resolver:((value:string|null)=>void)|null=null,closed=false;
 const close=(value:string|null)=>{if(closed)return;closed=true;backdrop.remove();previous?.focus();resolver?.(value)};
 host.appendChild(body(close));
 backdrop.addEventListener("mousedown",e=>{if(e.target===backdrop)close(null)});
 backdrop.addEventListener("keydown",e=>{
  if(e.key==="Escape"){e.preventDefault();close(null)}
  if(e.key!=="Tab")return;
  const items=Array.from(card.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]"));
  const first=items[0],last=items[items.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
 });
 queueMicrotask(()=>card.querySelector<HTMLElement>("input,button")?.focus());
 return Object.assign(backdrop,{bind:(fn:(value:string|null)=>void)=>{resolver=fn}});
}
function ensureStyle(){if(document.getElementById("crz-action-dialog-style"))return;const s=document.createElement("style");s.id="crz-action-dialog-style";s.textContent=`.crz-action-dialog-backdrop{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(0,4,12,.78);backdrop-filter:blur(9px)}.crz-action-dialog{width:min(480px,100%);display:grid;gap:14px;padding:18px;border:1px solid rgba(54,136,255,.34);border-radius:14px;background:#07111e;box-shadow:0 30px 90px rgba(0,0,0,.6);color:#eef6ff}.crz-action-dialog h2{margin:0;font-size:18px}.crz-action-dialog__body{display:grid;gap:12px}.crz-action-dialog__body p{margin:0;color:#9cafc5;font-size:13px}.crz-action-dialog__body input{min-height:42px;border:1px solid rgba(72,130,207,.28);border-radius:9px;padding:0 11px;background:#0b1725;color:#f4f8ff;outline:0}.crz-action-dialog__actions{display:flex;justify-content:flex-end;gap:8px}.crz-action-dialog__actions button{min-height:38px;border:1px solid rgba(72,130,207,.28);border-radius:8px;padding:0 14px;background:#0b1725;color:#dce9f8;cursor:pointer}.crz-action-dialog__actions button:last-child{background:#075cff;border-color:#2580ff;color:white;font-weight:800}`;document.head.appendChild(s)}
export function adminPrompt(title:string,options:PromptOptions|string=""){ensureStyle();const o=typeof options==="string"?{label:title,defaultValue:options}:options;return new Promise<string|null>(resolve=>{const root=mount(title,close=>{const wrap=document.createElement("div");wrap.className="crz-action-dialog__body";const p=document.createElement("p");p.textContent=o.label;wrap.appendChild(p);const input=document.createElement("input");input.setAttribute("aria-label",o.label);input.value=o.defaultValue||"";input.placeholder=o.placeholder||"";input.inputMode=o.inputMode||"text";wrap.appendChild(input);const actions=document.createElement("div");actions.className="crz-action-dialog__actions";const cancel=document.createElement("button");cancel.textContent="Cancelar";cancel.onclick=()=>close(null);const ok=document.createElement("button");ok.textContent=o.confirmLabel||"Continuar";ok.onclick=()=>{if(o.required&&!input.value.trim()){input.focus();return}close(input.value)};actions.append(cancel,ok);wrap.appendChild(actions);input.addEventListener("keydown",e=>{if(e.key==="Enter")ok.click();if(e.key==="Escape")cancel.click()});setTimeout(()=>input.focus(),0);return wrap}) as any;root.bind(resolve)})}
export function adminConfirm(title:string,message:string,confirmLabel="Confirmar"){ensureStyle();return new Promise<boolean>(resolve=>{const root=mount(title,close=>{const wrap=document.createElement("div");wrap.className="crz-action-dialog__body";const p=document.createElement("p");p.textContent=message;wrap.appendChild(p);const actions=document.createElement("div");actions.className="crz-action-dialog__actions";const cancel=document.createElement("button");cancel.textContent="Cancelar";cancel.onclick=()=>close("no");const ok=document.createElement("button");ok.textContent=confirmLabel;ok.onclick=()=>close("yes");actions.append(cancel,ok);wrap.appendChild(actions);return wrap}) as any;root.bind((v:string|null)=>resolve(v==="yes"))})}
