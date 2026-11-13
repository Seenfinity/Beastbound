import{d2 as t,d0 as K,d1 as $,d8 as z,dA as X,dw as F,d5 as r,dL as x,db as g,dI as Y,dy as H,d6 as b}from"./main-DeVKDuY8.js";import{F as Q}from"./EnvelopeIcon-Df3EI6y0.js";import{F as Z}from"./PhoneIcon-CHEScL0s.js";import{o as G}from"./Layouts-CaU-iybi-BfqJ8J2Z.js";import{i as J}from"./Link-BdDilT2T-a6jdlSWM.js";import{a as ee}from"./shouldProceedtoEmbeddedWalletCreationFlow-BhRtNzxm-BT4MjHxz.js";import{n as re}from"./ScreenLayout-D73wYqNX-DVouzZAC.js";import"./ModalFooter-CEqrNWY7-BqJhqmZi.js";import"./Screen-C7bUGqXu-BSfWKhJ9.js";import"./index-CWARkn2w-Cnm6JUVa.js";function oe({title:o,titleId:d,...S},u){return t.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20",fill:"currentColor","aria-hidden":"true","data-slot":"icon",ref:u,"aria-labelledby":d},S),o?t.createElement("title",{id:d},o):null,t.createElement("path",{fillRule:"evenodd",d:"M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z",clipRule:"evenodd"}))}const ae=t.forwardRef(oe),te=({contactMethod:o,authFlow:d,emailDomain:S,appName:u="Privy",whatsAppEnabled:_=!1,onBack:y,onCodeSubmit:R,onResend:k,errorMessage:E,success:h=!1,resendCountdown:I=0,onInvalidInput:j,onClearError:A,resetCodeSignal:N})=>{let[p,m]=t.useState(P);t.useEffect((()=>{m(P)}),[N]);let L=async l=>{l.preventDefault();let i=l.currentTarget.value.replace(" ","");if(i==="")return;if(isNaN(Number(i)))return void j?.("Code should be numeric");A?.();let s=Number(l.currentTarget.name?.charAt(5)),a=[...i||[""]].slice(0,U-s),f=[...p.slice(0,s),...a,...p.slice(s+a.length)];m(f);let v=Math.min(Math.max(s+a.length,0),U-1);isNaN(Number(l.currentTarget.value))||document.querySelector(`input[name=code-${v}]`)?.focus(),f.every((c=>c&&!isNaN(+c)))&&(document.querySelector(`input[name=code-${v}]`)?.blur(),await R?.(f.join("")))};return r.jsx(re,{title:"Enter confirmation code",subtitle:r.jsxs("span",d==="email"?{children:["Please check ",r.jsx(W,{children:o})," for an email from"," ",S??"privy.io"," and enter your code below."]}:{children:["Please check ",r.jsx(W,{children:o})," for a",_?" WhatsApp":""," message from ",u," and enter your code below."]}),icon:d==="email"?Q:Z,onBack:y,showBack:!0,helpText:r.jsxs(de,{children:[r.jsxs("span",{children:["Didn't get ",d==="email"?"an email":"a message","?"]}),I?r.jsxs(ue,{children:[r.jsx(ae,{color:"var(--privy-color-foreground)",strokeWidth:1.33,height:"12px",width:"12px"}),r.jsx("span",{children:"Code sent"})]}):r.jsx(J,{as:"button",size:"sm",onClick:k,children:"Resend code"})]}),children:r.jsx(se,{children:r.jsx(G,{children:r.jsxs(le,{children:[r.jsx("div",{children:p.map(((l,i)=>r.jsx("input",{name:`code-${i}`,type:"text",value:p[i],onChange:L,onKeyUp:s=>{s.key==="Backspace"&&(a=>{A?.(),m([...p.slice(0,a),"",...p.slice(a+1)]),a>0&&document.querySelector(`input[name=code-${a-1}]`)?.focus()})(i)},inputMode:"numeric",autoFocus:i===0,pattern:"[0-9]",className:`${h?"success":""} ${E?"fail":""}`,autoComplete:H.isMobile?"one-time-code":"off"},i)))}),r.jsx(ce,{$fail:!!E,$success:h,children:r.jsx("span",{children:E==="Invalid or expired verification code"?"Incorrect code":E||(h?"Success!":"")})})]})})})})};let U=6,P=Array(6).fill("");var w,C,ne=((w=ne||{})[w.RESET_AFTER_DELAY=0]="RESET_AFTER_DELAY",w[w.CLEAR_ON_NEXT_VALID_INPUT=1]="CLEAR_ON_NEXT_VALID_INPUT",w),ie=((C=ie||{})[C.EMAIL=0]="EMAIL",C[C.SMS=1]="SMS",C);const Se={component:()=>{let{navigate:o,lastScreen:d,navigateBack:S,setModalData:u,onUserCloseViaDialogOrKeybindRef:_}=K(),y=$(),{closePrivyModal:R,resendEmailCode:k,resendSmsCode:E,getAuthMeta:h,loginWithCode:I,updateWallets:j,createAnalyticsEvent:A}=z(),{authenticated:N,logout:p,user:m}=X(),{whatsAppEnabled:L}=$(),[l,i]=t.useState(!1),[s,a]=t.useState(null),[f,v]=t.useState(null),[c,M]=t.useState(0),[B,V]=t.useState(0);_.current=()=>null;let T=h()?.email?0:1,D=T===0?h()?.email||"":h()?.phoneNumber||"",O=F-500;return t.useEffect((()=>{if(c){let n=setTimeout((()=>{M(c-1)}),1e3);return()=>clearTimeout(n)}}),[c]),t.useEffect((()=>{if(N&&l&&m){if(y?.legal.requireUsersAcceptTerms&&!m.hasAcceptedTerms){let n=setTimeout((()=>{o("AffirmativeConsentScreen")}),O);return()=>clearTimeout(n)}if(ee(m,y.embeddedWallets)){let n=setTimeout((()=>{u({createWallet:{onSuccess:()=>{},onFailure:e=>{console.error(e),A({eventName:"embedded_wallet_creation_failure_logout",payload:{error:e,screen:"AwaitingPasswordlessCodeScreen"}}),p()},callAuthOnSuccessOnClose:!0}}),o("EmbeddedWalletOnAccountCreateScreen")}),O);return()=>clearTimeout(n)}{j();let n=setTimeout((()=>R({shouldCallAuthOnSuccess:!0,isSuccess:!0})),F);return()=>clearTimeout(n)}}}),[N,l,m]),t.useEffect((()=>{if(s&&f===0){let n=setTimeout((()=>{a(null),v(null),V((q=>q+1)),document.querySelector("input[name=code-0]")?.focus()}),1400);return()=>clearTimeout(n)}}),[s,f]),r.jsx(te,{contactMethod:D,authFlow:T===0?"email":"sms",emailDomain:y?.appearance.emailDomain,appName:y?.name,whatsAppEnabled:L,onBack:()=>S(),onCodeSubmit:async n=>{try{await I(n),i(!0)}catch(e){if(e instanceof x&&e.privyErrorCode===g.INVALID_CREDENTIALS)a("Invalid or expired verification code"),v(0);else if(e instanceof x&&e.privyErrorCode===g.CANNOT_LINK_MORE_OF_TYPE)a(e.message);else{if(e instanceof x&&e.privyErrorCode===g.USER_LIMIT_REACHED)return console.error(new Y(e).toString()),void o("UserLimitReachedScreen");if(e instanceof x&&e.privyErrorCode===g.USER_DOES_NOT_EXIST)return void o("AccountNotFoundScreen");if(e instanceof x&&e.privyErrorCode===g.LINKED_TO_ANOTHER_USER)return u({errorModalData:{error:e,previousScreen:d??"AwaitingPasswordlessCodeScreen"}}),void o("ErrorScreen",!1);if(e instanceof x&&e.privyErrorCode===g.DISALLOWED_PLUS_EMAIL)return u({inlineError:{error:e}}),void o("ConnectOrCreateScreen",!1);if(e instanceof x&&e.privyErrorCode===g.ACCOUNT_TRANSFER_REQUIRED&&e.data?.data?.nonce)return u({accountTransfer:{nonce:e.data?.data?.nonce,account:D,displayName:e.data?.data?.account?.displayName,linkMethod:T===0?"email":"sms",embeddedWalletAddress:e.data?.data?.otherUser?.embeddedWalletAddress}}),void o("LinkConflictScreen");a("Issue verifying code"),v(0)}}},onResend:async()=>{M(30),T===0?await k():await E()},errorMessage:s||void 0,success:l,resendCountdown:c,onInvalidInput:n=>{a(n),v(1)},onClearError:()=>{f===1&&(a(null),v(null))},resetCodeSignal:B})}};let se=b.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
  gap: 16px;
  flex-grow: 1;
  width: 100%;
`,le=b.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 12px;

  > div:first-child {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    border-radius: var(--privy-border-radius-sm);

    > input {
      border: 1px solid var(--privy-color-foreground-4);
      background: var(--privy-color-background);
      border-radius: var(--privy-border-radius-sm);
      padding: 8px 10px;
      height: 48px;
      width: 40px;
      text-align: center;
      font-size: 18px;
      font-weight: 600;
      color: var(--privy-color-foreground);
      transition: all 0.2s ease;
    }

    > input:focus {
      border: 1px solid var(--privy-color-foreground);
      box-shadow: 0 0 0 1px var(--privy-color-foreground);
    }

    > input:invalid {
      border: 1px solid var(--privy-color-error);
    }

    > input.success {
      border: 1px solid var(--privy-color-border-success);
      background: var(--privy-color-success-bg);
    }

    > input.fail {
      border: 1px solid var(--privy-color-border-error);
      background: var(--privy-color-error-bg);
      animation: shake 180ms;
      animation-iteration-count: 2;
    }
  }

  @keyframes shake {
    0% {
      transform: translate(1px, 0);
    }
    33% {
      transform: translate(-1px, 0);
    }
    67% {
      transform: translate(-1px, 0);
    }
    100% {
      transform: translate(1px, 0);
    }
  }
`,ce=b.div`
  line-height: 20px;
  min-height: 20px;
  font-size: 14px;
  font-weight: 400;
  color: ${o=>o.$success?"var(--privy-color-success-dark)":o.$fail?"var(--privy-color-error-dark)":"transparent"};
  display: flex;
  justify-content: center;
  width: 100%;
  text-align: center;
`,de=b.div`
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  width: 100%;
  color: var(--privy-color-foreground-2);
`,ue=b.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--privy-border-radius-sm);
  padding: 2px 8px;
  gap: 4px;
  background: var(--privy-color-background-2);
  color: var(--privy-color-foreground-2);
`,W=b.span`
  font-weight: 500;
  word-break: break-all;
  color: var(--privy-color-foreground);
`;export{Se as AwaitingPasswordlessCodeScreen,te as AwaitingPasswordlessCodeScreenView,Se as default};
