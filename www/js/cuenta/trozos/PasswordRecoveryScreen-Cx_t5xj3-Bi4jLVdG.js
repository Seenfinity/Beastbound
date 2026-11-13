import{d2 as a,dA as T,d8 as _,d0 as E,d5 as e,eL as I,eM as F,e7 as O,d6 as u,eg as U}from"./main-DeVKDuY8.js";import{F as W}from"./ShieldCheckIcon-FvwFESKb.js";import{b as M}from"./ModalFooter-CEqrNWY7-BqJhqmZi.js";import{l as N}from"./Layouts-CaU-iybi-BfqJ8J2Z.js";import{g as V,h as H,y as z,w as L,k as q}from"./shared-DmlxgMuJ-BNy1KUrn.js";import{w as s}from"./Screen-C7bUGqXu-BSfWKhJ9.js";import"./index-CWARkn2w-Cnm6JUVa.js";const re={component:()=>{let[o,h]=a.useState(!0),{authenticated:p,user:g}=T(),{walletProxy:y,closePrivyModal:m,createAnalyticsEvent:v,client:j}=_(),{navigate:b,data:k,onUserCloseViaDialogOrKeybindRef:A}=E(),[l,C]=a.useState(void 0),[x,n]=a.useState(""),[d,f]=a.useState(!1),{entropyId:c,entropyIdVerifier:P,onCompleteNavigateTo:w,onSuccess:S,onFailure:R}=k.recoverWallet,i=(r="User exited before their wallet could be recovered")=>{m({shouldCallAuthOnSuccess:!1}),R(typeof r=="string"?new O(r):r)};return A.current=i,a.useEffect((()=>{if(!p)return i("User must be authenticated and have a Privy wallet before it can be recovered")}),[p]),e.jsxs(s,{children:[e.jsx(s.Header,{icon:W,title:"Enter your password",subtitle:"Please provision your account on this new device. To continue, enter your recovery password.",showClose:!0,onClose:i}),e.jsx(s.Body,{children:e.jsx(B,{children:e.jsxs("div",{children:[e.jsxs(V,{children:[e.jsx(H,{type:o?"password":"text",onChange:r=>(t=>{t&&C(t)})(r.target.value),disabled:d,style:{paddingRight:"2.3rem"}}),e.jsx(z,{style:{right:"0.75rem"},children:o?e.jsx(L,{onClick:()=>h(!1)}):e.jsx(q,{onClick:()=>h(!0)})})]}),!!x&&e.jsx(D,{children:x})]})})}),e.jsxs(s.Footer,{children:[e.jsx(s.HelpText,{children:e.jsxs(N,{children:[e.jsx("h4",{children:"Why is this necessary?"}),e.jsx("p",{children:"You previously set a password for this wallet. This helps ensure only you can access it"})]})}),e.jsx(s.Actions,{children:e.jsx(K,{loading:d||!y,disabled:!l,onClick:async()=>{f(!0);let r=await j.getAccessToken(),t=I(g,c);if(!r||!t||l===null)return i("User must be authenticated and have a Privy wallet before it can be recovered");try{v({eventName:"embedded_wallet_recovery_started",payload:{walletAddress:t.address}}),await y?.recover({accessToken:r,entropyId:c,entropyIdVerifier:P,recoveryPassword:l}),n(""),w?b(w):m({shouldCallAuthOnSuccess:!1}),S?.(t),v({eventName:"embedded_wallet_recovery_completed",payload:{walletAddress:t.address}})}catch($){F($)?n("Invalid recovery password, please try again."):n("An error has occurred, please try again.")}finally{f(!1)}},$hideAnimations:!c&&d,children:"Recover your account"})}),e.jsx(s.Watermark,{})]})]})}};let B=u.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`,D=u.div`
  line-height: 20px;
  height: 20px;
  font-size: 13px;
  color: var(--privy-color-error);
  text-align: left;
  margin-top: 0.5rem;
`,K=u(M)`
  ${({$hideAnimations:o})=>o&&U`
      && {
        /* Remove animations because the recoverWallet task on the iframe partially
           blocks the renderer, so the animation stutters and doesn't look good */
        transition: none;
      }
    `}
`;export{re as PasswordRecoveryScreen,re as default};
