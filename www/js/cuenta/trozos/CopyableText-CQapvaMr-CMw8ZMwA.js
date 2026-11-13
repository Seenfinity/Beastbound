import{d2 as h,d5 as e,d6 as s}from"./main-zE9T7OVV.js";import{C as f}from"./check-_9OshMeO.js";import{C as g}from"./copy-S29BCS1K.js";let a=s.button`
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 0.5rem;

  && {
    color: var(--privy-color-foreground);
    font-weight: 500;
  }

  svg {
    width: 0.875rem;
    height: 0.875rem;
  }
`,p=s.span`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--privy-color-foreground-2);
`,u=s(f)`
  color: var(--privy-color-icon-success);
  flex-shrink: 0;
`,x=s(g)`
  color: var(--privy-color-icon-muted);
  flex-shrink: 0;
`;function C({children:r,iconOnly:l,value:i,hideCopyIcon:t,onCopy:c,iconSize:o=14,...n}){let[m,d]=h.useState(!1);return e.jsxs(a,{...n,onClick:()=>{navigator.clipboard.writeText(i||(typeof r=="string"?r:"")).then((()=>c?.())).catch(console.error),d(!0),setTimeout((()=>d(!1)),1500)},children:[r," ",m?e.jsxs(p,{children:[e.jsx(u,{size:o})," ",!l&&"Copied"]}):!t&&e.jsx(x,{size:o})]})}const k=({value:r,includeChildren:l,children:i,...t})=>{let[c,o]=h.useState(!1),n=()=>{navigator.clipboard.writeText(r).catch(console.error),o(!0),setTimeout((()=>o(!1)),1500)};return e.jsxs(e.Fragment,{children:[l?e.jsx(a,{...t,onClick:n,children:i}):e.jsx(e.Fragment,{children:i}),e.jsx(a,{...t,onClick:n,children:c?e.jsx(p,{children:e.jsx(u,{})}):e.jsx(x,{})})]})};export{k as h,C as p};
