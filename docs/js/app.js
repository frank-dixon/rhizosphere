import{MODES as c,ORGANISMS as A,CITATIONS as b,organismById as v,citationById as y}from"./data.js";import{RhizosphereScene as S}from"./scene.js";const h="rhizosphere-mode";function r(t,e=document){return e.querySelector(t)}function E(){return localStorage.getItem(h)===c.ADVANCED?c.ADVANCED:c.SIMPLE}function D(t){localStorage.setItem(h,t)}function L(t){t.innerHTML=A.map(e=>`<button type="button" class="hotspot-chip" data-org="${e.id}" aria-label="Show ${e.label}">
        <span class="dot" style="background:${e.accent}"></span>
        <span class="chip-label">${e.label}</span>
        <span class="chip-zone">${e.zone||""}</span>
      </button>`).join("")}function $(t){t.innerHTML=b.map(e=>`<li class="source-item">
        <span class="source-short">${e.short}</span>
        <p class="source-full">${e.full}</p>
      </li>`).join("")}function p(t,e,n){const l=r("#detail-empty",t),a=r("#detail-body",t);if(!e){l.hidden=!1,a.hidden=!0,a.innerHTML="";return}const o=v(e);if(!o)return;const i=n===c.ADVANCED?o.advanced:o.simple;l.hidden=!0,a.hidden=!1;let d="";n===c.ADVANCED&&i.cites&&i.cites.length&&(d=`<div class="cite-stack">
      ${i.cites.map(u=>{const s=y(u);return s?`<blockquote class="cite"><span class="cite-tag">${s.short}</span>${s.full}</blockquote>`:""}).join("")}
    </div>`),a.innerHTML=`
    <div class="detail-meta">
      <span class="detail-swatch" style="background:${o.accent}" aria-hidden="true"></span>
      <p class="detail-kicker">${o.zone||"Rhizosphere"} \xB7 ${n===c.ADVANCED?"Advanced":"Simple"}</p>
    </div>
    <h2 class="detail-title">${i.title}</h2>
    <p class="detail-lede">${i.lede}</p>
    <p class="detail-body">${i.body}</p>
    ${d}
  `}function m(t){document.querySelectorAll("[data-mode]").forEach(e=>{const n=e.getAttribute("data-mode")===t;e.classList.toggle("on",n),e.setAttribute("aria-pressed",n?"true":"false")})}function k(t,e){t.querySelectorAll("[data-org]").forEach(n=>{const l=n.getAttribute("data-org")===e;n.classList.toggle("is-active",l),n.setAttribute("aria-pressed",l?"true":"false")})}function w(){if(!("serviceWorker"in navigator))return;const t=location.hostname==="localhost"||location.hostname==="127.0.0.1"||location.protocol==="file:";location.protocol!=="https:"&&!t||window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(e=>{console.warn("SW registration skipped:",e.message)})})}function f(){const t=r("#soil-canvas"),e=r("#detail-panel"),n=r("#organism-legend"),l=r("#sources-list"),a=r("#mode-status");let o=E();m(o),a&&(a.textContent=o===c.ADVANCED?"Mechanisms, pathways, and primary literature.":"Full-sentence ecology without jargon overload."),L(n),$(l),p(e,null,o);const i=new S(t,{onSelect(s){p(e,s,o),k(n,s),s&&e.scrollIntoView({behavior:"smooth",block:"nearest"})}});document.querySelectorAll("[data-mode]").forEach(s=>{s.addEventListener("click",()=>{o=s.getAttribute("data-mode"),D(o),m(o),a&&(a.textContent=o===c.ADVANCED?"Mechanisms, pathways, and primary literature.":"Full-sentence ecology without jargon overload."),p(e,i.selectedId,o)})}),n.addEventListener("click",s=>{const g=s.target.closest("[data-org]");g&&i.select(g.getAttribute("data-org"))});const d=r("#sources-toggle"),u=r("#sources-panel");d&&u&&d.addEventListener("click",()=>{const s=u.hasAttribute("hidden");s?u.removeAttribute("hidden"):u.setAttribute("hidden",""),d.setAttribute("aria-expanded",s?"true":"false")}),t.addEventListener("contextmenu",s=>s.preventDefault()),w()}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",f):f();
