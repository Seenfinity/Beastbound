import{dA as D,d0 as $,d2 as f,fB as P,dS as S,d5 as t,fC as z,dy as R,d6 as v}from"./main-zE9T7OVV.js";import{h as V}from"./CopyableText-CQapvaMr-CMw8ZMwA.js";import{n as C}from"./ScreenLayout-D73wYqNX-CVWKpo00.js";import{t as M}from"./InfoBanner-Cb3p1z12-DUrRavuR.js";import{w as Y,c as q,p as H}from"./SelectSourceAsset-CuVkpdXI-BQAtWfPT.js";import{c as O}from"./createLucideIcon-D3i1cH6t.js";import{H as K}from"./hourglass-BbHbwixf.js";import{C as N}from"./check-_9OshMeO.js";import{C as B}from"./circle-x-DxPqocJV.js";import"./copy-S29BCS1K.js";import"./ModalFooter-CEqrNWY7-Dz2ks9vq.js";import"./Screen-C7bUGqXu-BPQ__I6d.js";import"./index-CWARkn2w-BtDkuApS.js";import"./chevron-down-DJ1Nq4Ou.js";const X=[["path",{d:"m16 11 2 2 4-4",key:"9rsbq5"}],["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}]],Z=O("user-check",X),G=e=>{try{return e.location.origin}catch{return}},J=({data:e,onClose:a})=>t.jsx(C,{showClose:!0,onClose:a,title:"Initiate bank transfer",subtitle:"Use the details below to complete a bank transfer from your bank.",primaryCta:{label:"Done",onClick:a},watermark:!1,footerText:"Exchange rates and fees are set when you authorize and determine the amount you receive. You'll see the applicable rates and fees for your transaction separately",children:t.jsx(Q,{children:(z[e.deposit_instructions.asset]||[]).map((([l,y],h)=>{let m=e.deposit_instructions[l];if(!m||Array.isArray(m))return null;let d=l==="asset"?m.toUpperCase():m,i=d.length>100?`${d.slice(0,9)}...${d.slice(-9)}`:d;return t.jsxs(ee,{children:[t.jsx(te,{children:y}),t.jsx(V,{value:d,includeChildren:R.isMobile,children:t.jsx(se,{children:i})})]},h)}))})});let Q=v.ol`
  border-color: var(--privy-color-border-default);
  border-width: 1px;
  border-radius: var(--privy-border-radius-mdlg);
  border-style: solid;
  display: flex;
  flex-direction: column;

  && {
    padding: 0 1rem;
  }
`,ee=v.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;

  &:not(:first-of-type) {
    border-top: 1px solid var(--privy-color-border-default);
  }

  & > {
    :nth-child(1) {
      flex-basis: 30%;
    }

    :nth-child(2) {
      flex-basis: 60%;
    }
  }
`,te=v.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-variant-numeric: lining-nums proportional-nums;
  font-feature-settings: 'calt' off;

  /* text-xs/font-regular */
  font-size: 0.75rem;
  font-style: normal;
  font-weight: 400;
  line-height: 1.125rem; /* 150% */

  text-align: left;
  flex-shrink: 0;
`,se=v.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-feature-settings: 'calt' off;

  /* text-sm/font-medium */
  font-size: 0.875rem;
  font-style: normal;
  font-weight: 500;
  line-height: 1.375rem; /* 157.143% */

  text-align: right;
  word-break: break-all;
`;const re=({onClose:e})=>t.jsx(C,{showClose:!0,onClose:e,icon:B,iconVariant:"error",title:"Something went wrong",subtitle:"We couldn't complete account setup. This isn't caused by anything you did.",primaryCta:{label:"Close",onClick:e},watermark:!0}),oe=({onClose:e,reason:a})=>{let l=a?a.charAt(0).toLowerCase()+a.slice(1):void 0;return t.jsx(C,{showClose:!0,onClose:e,icon:B,iconVariant:"error",title:"Identity verification failed",subtitle:l?`We can't complete identity verification because ${l}. Please try again or contact support for assistance.`:"We couldn't verify your identity. Please try again or contact support for assistance.",primaryCta:{label:"Close",onClick:e},watermark:!0})},ae=({onClose:e,email:a})=>t.jsx(C,{showClose:!0,onClose:e,icon:K,title:"Identity verification in progress",subtitle:"We're waiting for Persona to approve your identity verification. This usually takes a few minutes, but may take up to 24 hours.",primaryCta:{label:"Done",onClick:e},watermark:!0,children:t.jsxs(M,{theme:"light",children:["You'll receive an email at ",a," once approved with instructions for completing your deposit."]})}),ne=({onClose:e,onAcceptTerms:a,isLoading:l})=>t.jsx(C,{showClose:!0,onClose:e,icon:Z,title:"Verify your identity to continue",subtitle:"Finish verification with Persona — it takes just a few minutes and requires a government ID.",helpText:t.jsxs(t.Fragment,{children:[`This app uses Bridge to securely connect accounts and move funds. By clicking "Accept," you agree to Bridge's`," ",t.jsx("a",{href:"https://www.bridge.xyz/legal",target:"_blank",rel:"noopener noreferrer",children:"Terms of Service"})," ","and"," ",t.jsx("a",{href:"https://www.bridge.xyz/legal/row-privacy-policy/bridge-building-limited",target:"_blank",rel:"noopener noreferrer",children:"Privacy Policy"}),"."]}),primaryCta:{label:"Accept and continue",onClick:a,loading:l},watermark:!0}),ie=({onClose:e})=>t.jsx(C,{showClose:!0,onClose:e,icon:N,iconVariant:"success",title:"Identity verified successfully",subtitle:"We've successfully verified your identity. Now initiate a bank transfer to view instructions.",primaryCta:{label:"Initiate bank transfer",onClick:()=>{},loading:!0},watermark:!0}),le=({opts:e,onClose:a,onBack:l,onEditSourceAsset:y,onSelectAmount:h,isLoading:m})=>t.jsxs(C,{showClose:!0,onClose:a,showBack:!!l,onBack:l,headerTitle:`Buy ${e.destination.asset.toLocaleUpperCase()}`,primaryCta:{label:"Continue",onClick:h,loading:m},watermark:!0,children:[t.jsx(q,{currency:e.source.selectedAsset,inputMode:"decimal",autoFocus:!0}),t.jsx(H,{selectedAsset:e.source.selectedAsset,onEditSourceAsset:y})]}),ce=({onClose:e,onBack:a,onAcceptTerms:l,onSelectAmount:y,onSelectSource:h,onEditSourceAsset:m,opts:d,state:i,email:w,isLoading:n})=>i.status==="select-amount"?t.jsx(le,{onClose:e,onBack:a,onSelectAmount:y,onEditSourceAsset:m,opts:d,isLoading:n}):i.status==="select-source-asset"?t.jsx(Y,{onSelectSource:h,opts:d,isLoading:n}):i.status==="kyc-prompt"?t.jsx(ne,{onClose:e,onAcceptTerms:l,opts:d,isLoading:n}):i.status==="kyc-incomplete"?t.jsx(ae,{onClose:e,email:w}):i.status==="kyc-success"?t.jsx(ie,{onClose:e}):i.status==="kyc-error"?t.jsx(oe,{onClose:e,reason:i.reason}):i.status==="account-details"?t.jsx(J,{onClose:e,data:i.data}):i.status==="create-customer-error"||i.status==="get-customer-error"?t.jsx(re,{onClose:e}):null,je={component:()=>{let{user:e}=D(),a=$().data;if(!a?.FundWithBankDepositScreen)throw Error("Missing data");let{onSuccess:l,onFailure:y,onBack:h,opts:m,createOrUpdateCustomer:d,getCustomer:i,getOrCreateVirtualAccount:w}=a.FundWithBankDepositScreen,[n,A]=f.useState(m),[g,s]=f.useState({status:"select-amount"}),[x,c]=f.useState(null),[E,o]=f.useState(!1),b=f.useRef(null),U=f.useCallback((async()=>{let r;o(!0),c(null);try{r=await i({kycRedirectUrl:window.location.origin})}catch(u){if(!u||typeof u!="object"||!("status"in u)||u.status!==404)return s({status:"get-customer-error"}),c(u),void o(!1)}if(!r)try{r=await d({hasAcceptedTerms:!1,kycRedirectUrl:window.location.origin})}catch(u){return s({status:"create-customer-error"}),c(u),void o(!1)}if(!r)return s({status:"create-customer-error"}),c(Error("Unable to create customer")),void o(!1);if(r.status==="not_started"&&r.kyc_url)return s({status:"kyc-prompt",kycUrl:r.kyc_url}),void o(!1);if(r.status==="not_started")return s({status:"get-customer-error"}),c(Error("Unexpected user state")),void o(!1);if(r.status==="rejected")return s({status:"kyc-error",reason:r.rejection_reasons?.[0]?.reason}),c(Error("User KYC rejected.")),void o(!1);if(r.status==="incomplete")return s({status:"kyc-incomplete"}),void o(!1);if(r.status!=="active")return s({status:"get-customer-error"}),c(Error("Unexpected user state")),void o(!1);r.status;try{let u=await w({destination:n.destination,provider:n.provider,source:{asset:n.source.selectedAsset}});s({status:"account-details",data:u})}catch(u){return s({status:"create-customer-error"}),c(u),void o(!1)}}),[n]),T=f.useCallback((async()=>{if(c(null),o(!0),g.status!=="kyc-prompt")return c(Error("Unexpected state")),void o(!1);let r=P({location:g.kycUrl});try{await d({hasAcceptedTerms:!0})}catch(p){return r&&!r.closed&&r.close(),s({status:"create-customer-error"}),c(p),void o(!1)}if(!r)return c(Error("Unable to begin kyc flow.")),o(!1),void s({status:"create-customer-error"});b.current=new AbortController;let u=await(async(p,W)=>{let j=await S({operation:async()=>({done:G(p)===window.location.origin,closed:p.closed}),until:({done:F,closed:I})=>F||I,delay:0,interval:500,attempts:360,signal:W});return j.status==="aborted"?(p.close(),{status:"aborted"}):j.status==="max_attempts"?{status:"timeout"}:j.result.done?(p.close(),{status:"redirected"}):{status:"closed"}})(r,b.current.signal);if(u.status==="aborted")return;if(u.status==="closed")return void o(!1);u.status;let k=await S({operation:()=>i({}),until:p=>p.status==="active"||p.status==="rejected",delay:0,interval:2e3,attempts:60,signal:b.current.signal});if(k.status!=="aborted"){if(k.status==="max_attempts")return s({status:"kyc-incomplete"}),void o(!1);if(k.status,k.result.status==="rejected")return s({status:"kyc-error",reason:k.result.rejection_reasons?.[0]?.reason}),c(Error("User KYC rejected.")),void o(!1);if(k.result.status!=="active")return s({status:"kyc-incomplete"}),void o(!1);r.closed||r.close(),k.result.status;try{s({status:"kyc-success"});let p=await w({destination:n.destination,provider:n.provider,source:{asset:n.source.selectedAsset}});s({status:"account-details",data:p})}catch(p){s({status:"create-customer-error"}),c(p)}finally{o(!1)}}}),[s,c,o,d,w,g,n,b]),_=f.useCallback((r=>{s({status:"select-amount"}),A({...n,source:{...n.source,selectedAsset:r}})}),[s,A]),L=f.useCallback((()=>{s({status:"select-source-asset"})}),[s]);return t.jsx(ce,{onClose:f.useCallback((async()=>{b.current?.abort(),!n.showBackButton||g.status!=="select-amount"&&g.status!=="select-source-asset"?x?y(x):await l():y(Error("User cancelled funding"))}),[x,b,y,l,n.showBackButton,g.status]),onBack:h,opts:n,state:g,isLoading:E,email:e.email.address,onAcceptTerms:T,onSelectAmount:U,onSelectSource:_,onEditSourceAsset:L})}};export{je as FundWithBankDepositScreen,je as default};
