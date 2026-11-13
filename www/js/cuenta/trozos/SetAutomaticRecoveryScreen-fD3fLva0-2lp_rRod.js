import{dA as R,d8 as U,d0 as $,d2 as y,d5 as e,ex as w,eL as x,dw as k,d6 as A}from"./main-DeVKDuY8.js";import{F as I}from"./ExclamationTriangleIcon-CgrvMmHG.js";import{F as M}from"./LockClosedIcon-C9SYtT3k.js";import{L as g,u as v,h as j}from"./ModalFooter-CEqrNWY7-BqJhqmZi.js";import{r as P}from"./Subtitle-CV-2yKE4-CRIrgf_3.js";import{e as S}from"./Title-BnzYV3Is-BR8Ic2xg.js";const W=A.div`
  && {
    border-width: 4px;
  }

  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  aspect-ratio: 1;
  border-style: solid;
  border-color: ${t=>t.$color??"var(--privy-color-accent)"};
  border-radius: 50%;
`,N={component:()=>{let{user:t}=R(),{client:b,walletProxy:u,refreshSessionAndUser:T,closePrivyModal:s}=U(),r=$(),{entropyId:m,entropyIdVerifier:C}=r.data?.recoverWallet??{},[a,f]=y.useState(!1),[l,E]=y.useState(null),[i,h]=y.useState(null);function n(){if(!a){if(i)return r.data?.setWalletPassword?.onFailure(i),void s();if(!l)return r.data?.setWalletPassword?.onFailure(Error("User exited set recovery flow")),void s()}}r.onUserCloseViaDialogOrKeybindRef.current=n;let F=!(!a&&!l);return e.jsxs(e.Fragment,i?{children:[e.jsx(g,{onClose:n},"header"),e.jsx(W,{$color:"var(--privy-color-error)",style:{alignSelf:"center"},children:e.jsx(I,{height:38,width:38,stroke:"var(--privy-color-error)"})}),e.jsx(S,{style:{marginTop:"0.5rem"},children:"Something went wrong"}),e.jsx(w,{style:{minHeight:"2rem"}}),e.jsx(v,{onClick:()=>h(null),children:"Try again"}),e.jsx(j,{})]}:{children:[e.jsx(g,{onClose:n},"header"),e.jsx(M,{style:{width:"3rem",height:"3rem",alignSelf:"center"}}),e.jsx(S,{style:{marginTop:"0.5rem"},children:"Automatically secure your account"}),e.jsx(P,{style:{marginTop:"1rem"},children:"When you log into a new device, you’ll only need to authenticate to access your account. Never get logged out if you forget your password."}),e.jsx(w,{style:{minHeight:"2rem"}}),e.jsx(v,{loading:a,disabled:F,onClick:()=>(async function(){f(!0);try{let o=await b.getAccessToken(),c=x(t,m);if(!o||!u||!c)return;if(!(await u.setRecovery({accessToken:o,entropyId:m,entropyIdVerifier:C,existingRecoveryMethod:c.recoveryMethod,recoveryMethod:"privy"})).entropyId)throw Error("Unable to set recovery on wallet");let d=await T();if(!d)throw Error("Unable to set recovery on wallet");let p=x(d,c.address);if(!p)throw Error("Unabled to set recovery on wallet");E(!!d),setTimeout((()=>{r.data?.setWalletPassword?.onSuccess(p),s()}),k)}catch(o){h(o)}finally{f(!1)}})(),children:l?"Success":"Confirm"}),e.jsx(j,{})]})}};export{N as SetAutomaticRecoveryScreen,N as default};
