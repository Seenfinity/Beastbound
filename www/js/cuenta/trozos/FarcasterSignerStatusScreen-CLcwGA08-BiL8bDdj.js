import{d0 as F,d1 as T,d8 as I,d2 as c,dw as y,d5 as a,dy as h,dt as O,d6 as o}from"./main-zE9T7OVV.js";import{h as q}from"./CopyToClipboard-i_OQSBJr--3r_rQdX.js";import{n as B}from"./OpenLink-CUpJ1mOr-Bst3fP7F.js";import{$ as E}from"./QrCode-BPg5-1Xn-jxKQF7yo.js";import{n as M}from"./ScreenLayout-D73wYqNX-CVWKpo00.js";import{l as x}from"./farcaster-DPlSjvF5-BFpzTY2y.js";import"./dijkstra-COg3n3zL.js";import"./ModalFooter-CEqrNWY7-Dz2ks9vq.js";import"./Screen-C7bUGqXu-BPQ__I6d.js";import"./index-CWARkn2w-BtDkuApS.js";let S="#8a63d2";const _=({appName:d,loading:m,success:u,errorMessage:e,connectUri:t,onBack:r,onClose:l,onOpenFarcaster:s})=>a.jsx(M,h.isMobile||m?h.isIOS?{title:e?e.message:"Add a signer to Farcaster",subtitle:e?e.detail:`This will allow ${d} to add casts, likes, follows, and more on your behalf.`,icon:x,iconVariant:"loading",iconLoadingStatus:{success:u,fail:!!e},primaryCta:t&&s?{label:"Open Farcaster app",onClick:s}:void 0,onBack:r,onClose:l,watermark:!0}:{title:e?e.message:"Requesting signer from Farcaster",subtitle:e?e.detail:"This should only take a moment",icon:x,iconVariant:"loading",iconLoadingStatus:{success:u,fail:!!e},onBack:r,onClose:l,watermark:!0,children:t&&h.isMobile&&a.jsx(A,{children:a.jsx(B,{text:"Take me to Farcaster",url:t,color:S})})}:{title:"Add a signer to Farcaster",subtitle:`This will allow ${d} to add casts, likes, follows, and more on your behalf.`,onBack:r,onClose:l,watermark:!0,children:a.jsxs(L,{children:[a.jsx(R,{children:t?a.jsx(E,{url:t,size:275,squareLogoElement:x}):a.jsx(P,{children:a.jsx(O,{})})}),a.jsxs(V,{children:[a.jsx(N,{children:"Or copy this link and paste it into a phone browser to open the Farcaster app."}),t&&a.jsx(q,{text:t,itemName:"link",color:S})]})]})});let A=o.div`
  margin-top: 24px;
`,L=o.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`,R=o.div`
  padding: 24px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 275px;
`,V=o.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`,N=o.div`
  font-size: 0.875rem;
  text-align: center;
  color: var(--privy-color-foreground-2);
`,P=o.div`
  position: relative;
  width: 82px;
  height: 82px;
`;const Y={component:()=>{let{lastScreen:d,navigateBack:m,data:u}=F(),e=T(),{requestFarcasterSignerStatus:t,closePrivyModal:r}=I(),[l,s]=c.useState(void 0),[k,v]=c.useState(!1),[b,w]=c.useState(!1),g=c.useRef([]),n=u?.farcasterSigner;c.useEffect((()=>{let j=Date.now(),i=setInterval((async()=>{if(!n?.public_key)return clearInterval(i),void s({retryable:!0,message:"Connect failed",detail:"Something went wrong. Please try again."});n.status==="approved"&&(clearInterval(i),v(!1),w(!0),g.current.push(setTimeout((()=>r({shouldCallAuthOnSuccess:!1,isSuccess:!0})),y)));let p=await t(n?.public_key),C=Date.now()-j;p.status==="approved"?(clearInterval(i),v(!1),w(!0),g.current.push(setTimeout((()=>r({shouldCallAuthOnSuccess:!1,isSuccess:!0})),y))):C>3e5?(clearInterval(i),s({retryable:!0,message:"Connect failed",detail:"The request timed out. Try again."})):p.status==="revoked"&&(clearInterval(i),s({retryable:!0,message:"Request rejected",detail:"The request was rejected. Please try again."}))}),2e3);return()=>{clearInterval(i),g.current.forEach((p=>clearTimeout(p)))}}),[]);let f=n?.status==="pending_approval"?n.signer_approval_url:void 0;return a.jsx(_,{appName:e.name,loading:k,success:b,errorMessage:l,connectUri:f,onBack:d?m:void 0,onClose:r,onOpenFarcaster:()=>{f&&(window.location.href=f)}})}};export{Y as FarcasterSignerStatusScreen,_ as FarcasterSignerStatusView,Y as default};
