import{dA as M,d8 as U,d0 as O,d2 as o,fH as k,dF as E,e_ as _,e$ as w,d5 as t,dw as I,dW as F,fI as z,d6 as u,ch as q,ce as P,fJ as V}from"./main-zE9T7OVV.js";import{h as H}from"./CopyToClipboard-i_OQSBJr--3r_rQdX.js";import{d as J}from"./Layouts-CaU-iybi-DVowwwEH.js";import{a as $,i as W}from"./JsonTree-BHzNC-ic-CzMdwy66.js";import{n as G}from"./ScreenLayout-D73wYqNX-CVWKpo00.js";import{c as K}from"./createLucideIcon-D3i1cH6t.js";import"./ModalFooter-CEqrNWY7-Dz2ks9vq.js";import"./Screen-C7bUGqXu-BPQ__I6d.js";import"./index-CWARkn2w-BtDkuApS.js";const Q=[["path",{d:"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",key:"1m0v6g"}],["path",{d:"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",key:"ohrbg2"}]],B=K("square-pen",Q),X=u.img`
  && {
    height: ${e=>e.size==="sm"?"65px":"140px"};
    width: ${e=>e.size==="sm"?"65px":"140px"};
    border-radius: 16px;
    margin-bottom: 12px;
  }
`;let Y=e=>{if(!q(e))return e;try{let s=P(e);return s.includes("�")?e:s}catch{return e}},Z=e=>{try{let s=V.decode(e),n=new TextDecoder().decode(s);return n.includes("�")?e:n}catch{return e}},ee=e=>{let{types:s,primaryType:n,...l}=e.typedData;return t.jsxs(t.Fragment,{children:[t.jsx(ne,{data:l}),t.jsx(H,{text:(i=e.typedData,JSON.stringify(i,null,2)),itemName:"full payload to clipboard"})," "]});var i};const te=({method:e,messageData:s,copy:n,iconUrl:l,isLoading:i,success:p,walletProxyIsLoading:g,errorMessage:m,isCancellable:x,onSign:c,onCancel:y,onClose:d})=>t.jsx(G,{title:n.title,subtitle:n.description,showClose:!0,onClose:d,icon:B,iconVariant:"subtle",helpText:m?t.jsx(se,{children:m}):void 0,primaryCta:{label:n.buttonText,onClick:c,disabled:i||p||g,loading:i},secondaryCta:x?{label:"Not now",onClick:y,disabled:i||p||g}:void 0,watermark:!0,children:t.jsxs(J,{children:[l?t.jsx(X,{style:{alignSelf:"center"},size:"sm",src:l,alt:"app image"}):null,t.jsxs(ae,{children:[e==="personal_sign"&&t.jsx(b,{children:Y(s)}),e==="eth_signTypedData_v4"&&t.jsx(ee,{typedData:s}),e==="solana_signMessage"&&t.jsx(b,{children:Z(s)})]})]})}),me={component:()=>{let{authenticated:e}=M(),{initializeWalletProxy:s,closePrivyModal:n}=U(),{navigate:l,data:i,onUserCloseViaDialogOrKeybindRef:p}=O(),[g,m]=o.useState(!0),[x,c]=o.useState(""),[y,d]=o.useState(),[f,C]=o.useState(null),[R,S]=o.useState(!1);o.useEffect((()=>{e||l("LandingScreen")}),[e]),o.useEffect((()=>{s(k).then((a=>{m(!1),a||(c("An error has occurred, please try again."),d(new E(new _(x,w.E32603_DEFAULT_INTERNAL_ERROR.eipCode))))}))}),[]);let{method:j,data:v,confirmAndSign:L,onSuccess:D,onFailure:N,uiOptions:r}=i.signMessage,A={title:r?.title||"Sign message",description:r?.description||"Signing this message will not cost you any fees.",buttonText:r?.buttonText||"Sign and continue"},h=a=>{a?D(a):N(y||new E(new _("The user rejected the request.",w.E4001_USER_REJECTED_REQUEST.eipCode))),n({shouldCallAuthOnSuccess:!1}),setTimeout((()=>{C(null),c(""),d(void 0)}),200)};return p.current=()=>{h(f)},t.jsx(te,{method:j,messageData:v,copy:A,iconUrl:r?.iconUrl&&typeof r.iconUrl=="string"?r.iconUrl:void 0,isLoading:R,success:f!==null,walletProxyIsLoading:g,errorMessage:x,isCancellable:r?.isCancellable,onSign:async()=>{S(!0),c("");try{let a=await L();C(a),S(!1),setTimeout((()=>{h(a)}),I)}catch(a){console.error(a);let T=a instanceof F&&a.code===z.MISSING_MFA_ENROLLMENT?a.message:"An error has occurred, please try again.";c(T),d(new E(new _(T,w.E32603_DEFAULT_INTERNAL_ERROR.eipCode))),S(!1)}},onCancel:()=>h(null),onClose:()=>h(f)})}};let ae=u.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
`,se=u.p`
  && {
    margin: 0;
    width: 100%;
    text-align: center;
    color: var(--privy-color-error-dark);
    font-size: 14px;
    line-height: 22px;
  }
`,ne=u($)`
  margin-top: 0;
`,b=u(W)`
  margin-top: 0;
`;export{me as SignRequestScreen,te as SignRequestView,me as default};
