import{d2 as g,d6 as c,d8 as Le,dW as De,fI as te,d5 as e,d1 as oe,eG as Y,ex as ae,cf as Re}from"./main-zE9T7OVV.js";import{L as _,i as Pe,b as X,h as le,w as Be}from"./ModalFooter-CEqrNWY7-Dz2ks9vq.js";import{e as n,t as H,s,n as i,a as He}from"./Value-DTgR824E-8yb-9RWm.js";import{e as B}from"./ErrorMessage-D8VaAP5m-lz1sBYDd.js";import{r as T}from"./LabelXs-oqZNqbm_-CvjZLWgz.js";import{r as de}from"./Subtitle-CV-2yKE4-BitR_hb4.js";import{e as ce}from"./Title-BnzYV3Is-C-fATHkb.js";import{d}from"./Address-DDnyjfqr-CmPAWVPb.js";import{j as Ve}from"./WalletInfoCard-KURilPiq-BFzdLkvZ.js";import{i as xe}from"./LoadingSkeleton-BMsgO5PV-DrrBAdhX.js";import{d as qe}from"./shared-FM0rljBt-Bp-Uc44x.js";import{o as ze,F as We}from"./Checkbox-D1EDeo41-BFYxIz_Q.js";import{i as Ue}from"./ErrorBanner-BcpGRt0h-i6CeA6SH.js";import{t as Je}from"./WarningBanner-ZZqCEtZK-C2b1TMHe.js";import{F as _e}from"./ExclamationCircleIcon-CkDH-9Fs.js";import{F as he}from"./ChevronDownIcon-DIUR7zQ9.js";function Xe({title:a,titleId:l,...o},h){return g.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor","aria-hidden":"true","data-slot":"icon",ref:h,"aria-labelledby":l},o),a?g.createElement("title",{id:l},a):null,g.createElement("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"}))}const Ge=g.forwardRef(Xe);function Qe({title:a,titleId:l,...o},h){return g.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor","aria-hidden":"true","data-slot":"icon",ref:h,"aria-labelledby":l},o),a?g.createElement("title",{id:l},a):null,g.createElement("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"}))}const je=g.forwardRef(Qe);function Ze({title:a,titleId:l,...o},h){return g.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor","aria-hidden":"true","data-slot":"icon",ref:h,"aria-labelledby":l},o),a?g.createElement("title",{id:l},a):null,g.createElement("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z"}))}const Ye=g.forwardRef(Ze),me=c(n)`
  cursor: pointer;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  color: var(--privy-color-accent);
  svg {
    fill: var(--privy-color-accent);
  }
`;var K=({iconUrl:a,value:l,symbol:o,usdValue:h,nftName:b,nftCount:u,decimals:t,$isLoading:m})=>{if(m)return e.jsx($,{$isLoading:m});let f=l&&h&&t?(function(I,F,E){let S=parseFloat(I),x=parseFloat(E);if(S===0||x===0||Number.isNaN(S)||Number.isNaN(x))return I;let v=Math.ceil(-Math.log10(.01/(x/S))),y=Math.pow(10,v=Math.max(v=Math.min(v,F),1)),C=+(Math.floor(S*y)/y).toFixed(v).replace(/\.?0+$/,"");return Intl.NumberFormat(void 0,{maximumFractionDigits:F}).format(C)})(l,t,h):l;return e.jsxs("div",{children:[e.jsxs($,{$isLoading:m,children:[a&&e.jsx($e,{src:a,alt:"Token icon"}),u&&u>1?u+"x":void 0," ",b,f," ",o]}),h&&e.jsxs(Ke,{$isLoading:m,children:["$",h]})]})};let $=c.span`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.375rem;
  word-break: break-all;
  text-align: right;
  display: flex;
  justify-content: flex-end;

  /**
   * @NOTE This is a code smell anti-pattern for styling components.
   * We are mixing JSX definitions with styled-components CSS definitions.
   * This is not ideal and should be refactored in the future to separate concerns.
   * This is also hard to read, as it makes it difficult to understand the structure
   * of the component and its styles by viewing the JSX.
   */

  ${xe}
`;const Ke=c.span`
  color: var(--privy-color-foreground-2);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  word-break: break-all;
  text-align: right;
  display: flex;
  justify-content: flex-end;

  ${xe}
`;let $e=c.img`
  height: 14px;
  width: 14px;
  margin-right: 4px;
  object-fit: contain;
`;const er=a=>{let{chain:l,transactionDetails:o,isTokenContractInfoLoading:h,symbol:b}=a,{action:u,functionName:t}=o;return e.jsx(qe,{children:e.jsxs(H,{children:[u!=="transaction"&&e.jsxs(s,{children:[e.jsx(n,{children:"Action"}),e.jsx(i,{children:t})]}),t==="mint"&&"args"in o&&o.args.filter((m=>m)).map(((m,f)=>e.jsxs(s,{children:[e.jsx(n,{children:`Param ${f}`}),e.jsx(i,{children:typeof m=="string"&&Re(m)?e.jsx(d,{address:m,url:l?.blockExplorers?.default?.url,showCopyIcon:!1}):m?.toString()})]},f))),t==="setApprovalForAll"&&o.operator&&e.jsxs(s,{children:[e.jsx(n,{children:"Operator"}),e.jsx(i,{children:e.jsx(d,{address:o.operator,url:l?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),t==="setApprovalForAll"&&o.approved!==void 0&&e.jsxs(s,{children:[e.jsx(n,{children:"Set approval to"}),e.jsx(i,{children:o.approved?"true":"false"})]}),t==="transfer"||t==="transferWithMemo"||t==="transferFrom"||t==="safeTransferFrom"||t==="approve"?e.jsxs(e.Fragment,{children:["formattedAmount"in o&&o.formattedAmount&&e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsxs(i,{$isLoading:h,children:[o.formattedAmount," ",b]})]}),"tokenId"in o&&o.tokenId&&e.jsxs(s,{children:[e.jsx(n,{children:"Token ID"}),e.jsx(i,{children:o.tokenId.toString()})]})]}):null,t==="safeBatchTransferFrom"&&e.jsxs(e.Fragment,{children:["amounts"in o&&o.amounts&&e.jsxs(s,{children:[e.jsx(n,{children:"Amounts"}),e.jsx(i,{children:o.amounts.join(", ")})]}),"tokenIds"in o&&o.tokenIds&&e.jsxs(s,{children:[e.jsx(n,{children:"Token IDs"}),e.jsx(i,{children:o.tokenIds.join(", ")})]})]}),t==="approve"&&o.spender&&e.jsxs(s,{children:[e.jsx(n,{children:"Spender"}),e.jsx(i,{children:e.jsx(d,{address:o.spender,url:l?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),(t==="transferFrom"||t==="safeTransferFrom"||t==="safeBatchTransferFrom")&&o.transferFrom&&e.jsxs(s,{children:[e.jsx(n,{children:"Transferring from"}),e.jsx(i,{children:e.jsx(d,{address:o.transferFrom,url:l?.blockExplorers?.default?.url,showCopyIcon:!1})})]}),(t==="transferFrom"||t==="safeTransferFrom"||t==="safeBatchTransferFrom")&&o.transferTo&&e.jsxs(s,{children:[e.jsx(n,{children:"Transferring to"}),e.jsx(i,{children:e.jsx(d,{address:o.transferTo,url:l?.blockExplorers?.default?.url,showCopyIcon:!1})})]})]})})},rr=({variant:a,setPreventMaliciousTransaction:l,colorScheme:o="light",preventMaliciousTransaction:h})=>a==="warn"?e.jsx(ee,{children:e.jsxs(Je,{theme:o,children:[e.jsx("span",{style:{fontWeight:"500"},children:"Warning: Suspicious transaction"}),e.jsx("br",{}),"This has been flagged as a potentially deceptive request. Approving could put your assets or funds at risk."]})}):a==="error"?e.jsx(e.Fragment,{children:e.jsxs(ee,{children:[e.jsx(Ue,{theme:o,children:e.jsxs("div",{children:[e.jsx("strong",{children:"This is a malicious transaction"}),e.jsx("br",{}),"This transaction transfers tokens to a known malicious address. Proceeding may result in the loss of valuable assets."]})}),e.jsxs(sr,{children:[e.jsx(ze,{color:"var(--privy-color-error)",checked:!h,readOnly:!0,onClick:()=>l(!h)}),e.jsx("span",{children:"I understand and want to proceed anyways."})]})]})}):null;let ee=c.div`
  margin-top: 1.5rem;
`,sr=c.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;const nr=({transactionIndex:a,maxIndex:l})=>typeof a!="number"||l===0?"":` (${a+1} / ${l+1})`,Ar=({img:a,submitError:l,prepareError:o,onClose:h,action:b,title:u,subtitle:t,to:m,tokenAddress:f,network:I,missingFunds:F,fee:E,from:S,cta:x,disabled:v,chain:y,isSubmitting:C,isPreparing:p,isTokenPriceLoading:O,isTokenContractInfoLoading:L,isSponsored:D,symbol:V,balance:R,onClick:A,transactionDetails:M,transactionIndex:P,maxIndex:q,onBack:r,chainName:k,validation:z,hasScanDetails:G,setIsScanDetailsOpen:ke,preventMaliciousTransaction:ve,setPreventMaliciousTransaction:we,tokensSent:Q,tokensReceived:W,isScanning:be,isCancellable:Te,functionName:Ie})=>{let{showTransactionDetails:U,setShowTransactionDetails:Se,hasMoreDetails:Ce,isErc20Ish:Me}=(j=>{let[N,Oe]=g.useState(!1),J=!0,Z=!1;return(!j||j.isErc20Ish||j.action==="transaction")&&(J=!1),J&&(Z=Object.entries(j||{}).some((([Ae,Ne])=>Ne&&!["action","isErc20Ish","isNFTIsh"].includes(Ae)))),{showTransactionDetails:N,setShowTransactionDetails:Oe,hasMoreDetails:J&&Z,isErc20Ish:j?.isErc20Ish}})(M),Fe=oe(),Ee=Me&&L||p||O||be;return e.jsxs(e.Fragment,{children:[e.jsx(_,{onClose:h,backFn:r}),a&&e.jsx(ge,{children:a}),e.jsxs(ce,{style:{marginTop:a?"1.5rem":0},children:[u,e.jsx(nr,{maxIndex:q,transactionIndex:P})]}),e.jsx(de,{children:t}),e.jsxs(H,{style:{marginTop:"2rem"},children:[(!!Q[0]||Ee)&&e.jsxs(s,{children:[W.length>0?e.jsx(n,{children:"Send"}):e.jsx(n,{children:b==="approve"?"Approval amount":"Amount"}),e.jsx("div",{className:"flex flex-col",children:Q.map(((j,N)=>e.jsx(K,{iconUrl:j.iconUrl,value:Ie==="setApprovalForAll"?"All":j.value,usdValue:j.usdValue,symbol:j.symbol,nftName:j.nftName,nftCount:j.nftCount,decimals:j.decimals},N)))})]}),W.length>0&&e.jsxs(s,{children:[e.jsx(n,{children:"Receive"}),e.jsx("div",{className:"flex flex-col",children:W.map(((j,N)=>e.jsx(K,{iconUrl:j.iconUrl,value:j.value,usdValue:j.usdValue,symbol:j.symbol,nftName:j.nftName,nftCount:j.nftCount,decimals:j.decimals},N)))})]}),M&&"spender"in M&&M?.spender?e.jsxs(s,{children:[e.jsx(n,{children:"Spender"}),e.jsx(i,{children:e.jsx(d,{address:M.spender,url:y?.blockExplorers?.default?.url})})]}):null,m&&e.jsxs(s,{children:[e.jsx(n,{children:"To"}),e.jsx(i,{children:e.jsx(d,{address:m,url:y?.blockExplorers?.default?.url,showCopyIcon:!0})})]}),f&&e.jsxs(s,{children:[e.jsx(n,{children:"Token address"}),e.jsx(i,{children:e.jsx(d,{address:f,url:y?.blockExplorers?.default?.url})})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Network"}),e.jsx(i,{children:I})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Estimated fee"}),e.jsx(i,{$isLoading:p||O||D===void 0,children:D?e.jsxs(fe,{children:[e.jsxs(ye,{children:["Sponsored by ",Fe.name]}),e.jsx(je,{height:16,width:16})]}):E})]}),Ce&&!G&&e.jsxs(e.Fragment,{children:[e.jsx(s,{className:"cursor-pointer",onClick:()=>Se(!U),children:e.jsxs(He,{className:"flex items-center gap-x-1",children:["Details"," ",e.jsx(he,{style:{width:"0.75rem",marginLeft:"0.25rem",transform:U?"rotate(180deg)":void 0}})]})}),U&&M&&e.jsx(er,{action:b,chain:y,transactionDetails:M,isTokenContractInfoLoading:L,symbol:V})]}),G&&e.jsx(s,{children:e.jsxs(me,{onClick:()=>ke(!0),children:[e.jsx("span",{className:"text-color-primary",children:"Details"}),e.jsx(Ge,{height:"14px",width:"14px",strokeWidth:"2"})]})})]}),e.jsx(ae,{}),l?e.jsx(B,{style:{marginTop:"2rem"},children:l.message}):o&&P===0?e.jsx(B,{style:{marginTop:"2rem"},children:o.shortMessage??pe}):null,e.jsx(rr,{variant:z,preventMaliciousTransaction:ve,setPreventMaliciousTransaction:we}),e.jsx(ue,{$useSmallMargins:!(!o&&!l&&z!=="warn"&&z!=="error"),address:S,balance:R,errMsg:p||o||l||!F?void 0:`Add funds on ${y?.name??k} to complete transaction.`}),e.jsx(X,{style:{marginTop:"1rem"},loading:C,disabled:v||p,onClick:A,children:x}),Te&&e.jsx(Be,{style:{marginTop:"1rem"},onClick:h,isSubmitting:!1,children:"Not now"}),e.jsx(le,{})]})},Nr=({img:a,title:l,subtitle:o,cta:h,instructions:b,network:u,blockExplorerUrl:t,isMissingFunds:m,submitError:f,parseError:I,total:F,swap:E,transactingWalletAddress:S,fee:x,balance:v,disabled:y,isSubmitting:C,isPreparing:p,isTokenPriceLoading:O,onClick:L,onClose:D,onBack:V,isSponsored:R})=>{let A=p||O,[M,P]=g.useState(!1),q=oe();return e.jsxs(e.Fragment,{children:[e.jsx(_,{onClose:D,backFn:V}),a&&e.jsx(ge,{children:a}),e.jsx(ce,{style:{marginTop:a?"1.5rem":0},children:l}),e.jsx(de,{children:o}),e.jsxs(H,{style:{marginTop:"2rem",marginBottom:".5rem"},children:[(F||A)&&e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsx(i,{$isLoading:A,children:F})]}),E&&e.jsxs(s,{children:[e.jsx(n,{children:"Swap"}),e.jsx(i,{children:E})]}),u&&e.jsxs(s,{children:[e.jsx(n,{children:"Network"}),e.jsx(i,{children:u})]}),(x||A||R!==void 0)&&e.jsxs(s,{children:[e.jsx(n,{children:"Estimated fee"}),e.jsx(i,{$isLoading:A,children:R&&!A?e.jsxs(fe,{children:[e.jsxs(ye,{children:["Sponsored by ",q.name]}),e.jsx(je,{height:16,width:16})]}):x})]})]}),e.jsx(s,{children:e.jsxs(me,{onClick:()=>P((r=>!r)),children:[e.jsx("span",{children:"Advanced"}),e.jsx(he,{height:"16px",width:"16px",strokeWidth:"2",style:{transition:"all 300ms",transform:M?"rotate(180deg)":void 0}})]})}),M&&e.jsx(e.Fragment,{children:b.map(((r,k)=>r.type==="sol-transfer"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Transfer ",r.withSeed?"with seed":""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsxs(i,{children:[Y({amount:r.value,decimals:r.token.decimals})," ",r.token.symbol]})]}),!!r.toAccount&&e.jsxs(s,{children:[e.jsx(n,{children:"Destination"}),e.jsx(i,{children:e.jsx(d,{address:r.toAccount,url:t})})]})]},k):r.type==="spl-transfer"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Transfer ",r.token.symbol]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsx(i,{children:r.value.toString()})]}),!!r.fromAta&&e.jsxs(s,{children:[e.jsx(n,{children:"Source"}),e.jsx(i,{children:e.jsx(d,{address:r.fromAta,url:t})})]}),!!r.toAta&&e.jsxs(s,{children:[e.jsx(n,{children:"Destination"}),e.jsx(i,{children:e.jsx(d,{address:r.toAta,url:t})})]}),!!r.token.address&&e.jsxs(s,{children:[e.jsx(n,{children:"Token"}),e.jsx(i,{children:e.jsx(d,{address:r.token.address,url:t})})]})]},k):r.type==="ata-creation"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsx(T,{children:"Create token account"})}),e.jsxs(s,{children:[e.jsx(n,{children:"Program ID"}),e.jsx(i,{children:e.jsx(d,{address:r.program,url:t})})]}),!!r.owner&&e.jsxs(s,{children:[e.jsx(n,{children:"Owner"}),e.jsx(i,{children:e.jsx(d,{address:r.owner,url:t})})]})]},k):r.type==="create-account"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Create account ",r.withSeed?"with seed":""]})}),!!r.account&&e.jsxs(s,{children:[e.jsx(n,{children:"Account"}),e.jsx(i,{children:e.jsx(d,{address:r.account,url:t})})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount"}),e.jsxs(i,{children:[Y({amount:r.value,decimals:9})," SOL"]})]})]},k):r.type==="spl-init-account"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsx(T,{children:"Initialize token account"})}),!!r.account&&e.jsxs(s,{children:[e.jsx(n,{children:"Account"}),e.jsx(i,{children:e.jsx(d,{address:r.account,url:t})})]}),!!r.mint&&e.jsxs(s,{children:[e.jsx(n,{children:"Mint"}),e.jsx(i,{children:e.jsx(d,{address:r.mint,url:t})})]}),!!r.owner&&e.jsxs(s,{children:[e.jsx(n,{children:"Owner"}),e.jsx(i,{children:e.jsx(d,{address:r.owner,url:t})})]})]},k):r.type==="spl-close-account"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsx(T,{children:"Close token account"})}),!!r.source&&e.jsxs(s,{children:[e.jsx(n,{children:"Source"}),e.jsx(i,{children:e.jsx(d,{address:r.source,url:t})})]}),!!r.destination&&e.jsxs(s,{children:[e.jsx(n,{children:"Destination"}),e.jsx(i,{children:e.jsx(d,{address:r.destination,url:t})})]}),!!r.owner&&e.jsxs(s,{children:[e.jsx(n,{children:"Owner"}),e.jsx(i,{children:e.jsx(d,{address:r.owner,url:t})})]})]},k):r.type==="spl-sync-native"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsx(T,{children:"Sync native"})}),e.jsxs(s,{children:[e.jsx(n,{children:"Program ID"}),e.jsx(i,{children:e.jsx(d,{address:r.program,url:t})})]})]},k):r.type==="raydium-swap-base-input"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Raydium swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount in"}),e.jsx(i,{children:r.amountIn.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Minimum amount out"}),e.jsx(i,{children:r.minimumAmountOut.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(d,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(d,{address:r.mintOut,url:t})})]})]},k):r.type==="raydium-swap-base-output"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Raydium swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Max amount in"}),e.jsx(i,{children:r.maxAmountIn.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount out"}),e.jsx(i,{children:r.amountOut.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(d,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(d,{address:r.mintOut,url:t})})]})]},k):r.type==="jupiter-swap-shared-accounts-route"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Jupiter swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"In amount"}),e.jsx(i,{children:r.inAmount.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Quoted out amount"}),e.jsx(i,{children:r.quotedOutAmount.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(d,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(d,{address:r.mintOut,url:t})})]})]},k):r.type==="jupiter-swap-exact-out-route"?e.jsxs(w,{children:[e.jsx(s,{children:e.jsxs(T,{children:["Jupiter swap"," ",r.tokenIn&&r.tokenOut?`${r.tokenIn.symbol} → ${r.tokenOut.symbol}`:""]})}),e.jsxs(s,{children:[e.jsx(n,{children:"Quoted in amount"}),e.jsx(i,{children:r.quotedInAmount.toString()})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Amount out"}),e.jsx(i,{children:r.outAmount.toString()})]}),r.mintIn&&e.jsxs(s,{children:[e.jsx(n,{children:"Token in"}),e.jsx(i,{children:e.jsx(d,{address:r.mintIn,url:t})})]}),r.mintOut&&e.jsxs(s,{children:[e.jsx(n,{children:"Token out"}),e.jsx(i,{children:e.jsx(d,{address:r.mintOut,url:t})})]})]},k):e.jsxs(w,{children:[e.jsxs(s,{children:[e.jsx(n,{children:"Program ID"}),e.jsx(i,{children:e.jsx(d,{address:r.program,url:t})})]}),e.jsxs(s,{children:[e.jsx(n,{children:"Data"}),e.jsx(i,{children:r.discriminator})]})]},k)))}),e.jsx(ae,{}),f?e.jsx(B,{style:{marginTop:"2rem"},children:f.message}):I?e.jsx(B,{style:{marginTop:"2rem"},children:pe}):null,e.jsx(ue,{$useSmallMargins:!(!I&&!f),title:"",address:S,balance:v,errMsg:p||I||f||!m?void 0:"Add funds on Solana to complete transaction."}),e.jsx(X,{style:{marginTop:"1rem"},loading:C,disabled:y||p,onClick:L,children:h}),e.jsx(le,{})]})};let ue=c(Ve)`
  ${a=>a.$useSmallMargins?"margin-top: 0.5rem;":"margin-top: 2rem;"}
`,w=c(H)`
  margin-top: 0.5rem;
  border: 1px solid var(--privy-color-foreground-4);
  border-radius: var(--privy-border-radius-sm);
  padding: 0.5rem;
`,pe="There was an error preparing your transaction. Your transaction request will likely fail.",ge=c.div`
  display: flex;
  width: 100%;
  justify-content: center;
  max-height: 40px;

  > img {
    object-fit: contain;
    border-radius: var(--privy-border-radius-sm);
  }
`,fe=c.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
`,ye=c.span`
  font-size: 14px;
  font-weight: 500;
  color: var(--privy-color-foreground);
`,re=a=>a?.code===te.COMPLIANCE_BLOCKED,ir=()=>e.jsxs(lr,{children:[e.jsx(cr,{}),e.jsx(dr,{})]});const Lr=({transactionError:a,chainId:l,onClose:o,onRetry:h,chainType:b,transactionHash:u})=>{let{chains:t}=Le(),[m,f]=g.useState(!1),{errorCode:I,errorMessage:F}=((x,v)=>{if(x instanceof De&&x.code===te.MISSING_MFA_ENROLLMENT)return{errorCode:"MFA enrollment required",errorMessage:x.message};if(v==="ethereum")return re(x)?{errorCode:"Transaction blocked",errorMessage:x.message}:{errorCode:x.details??x.message,errorMessage:x.shortMessage};let y=x.txSignature,C=x?.transactionMessage||"Something went wrong.";if(Array.isArray(x.logs)){let p=x.logs.find((O=>/insufficient (lamports|funds)/gi.test(O)));p&&(C=p)}return{transactionHash:y,errorMessage:C}})(a,b),E=re(a),S=(({chains:x,chainId:v,chainType:y,transactionHash:C})=>y==="ethereum"?x.find((p=>p.id===v))?.blockExplorers?.default.url??"https://etherscan.io":(function(p,O){return`https://explorer.solana.com/tx/${p}?chain=${O}`})(C||"",v))({chains:t,chainId:l,chainType:b,transactionHash:u});return e.jsxs(e.Fragment,{children:[e.jsx(_,{onClose:o}),e.jsxs(tr,{children:[e.jsx(ir,{}),e.jsx(or,{children:I}),e.jsx(ar,{children:E?"This transaction cannot be completed.":"Please try again."}),e.jsxs(ne,{children:[e.jsx(se,{children:"Error message"}),e.jsx(ie,{$clickable:!1,children:F})]}),u&&e.jsxs(ne,{children:[e.jsx(se,{children:"Transaction hash"}),e.jsxs(hr,{children:["Copy this hash to view details about the transaction on a"," ",e.jsx("u",{children:e.jsx("a",{href:S,children:"block explorer"})}),"."]}),e.jsxs(ie,{$clickable:!0,onClick:async()=>{await navigator.clipboard.writeText(u),f(!0)},children:[u,e.jsx(ur,{clicked:m})]})]}),!E&&e.jsx(xr,{onClick:()=>h({resetNonce:!!u}),children:"Retry transaction"})]}),e.jsx(Pe,{})]})};let tr=c.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`,or=c.span`
  color: var(--privy-color-foreground);
  font-size: 1.125rem;
  font-weight: 500;
  line-height: 1.25rem; /* 111.111% */
  text-align: center;
  margin: 10px;
`,ar=c.span`
  margin-top: 4px;
  margin-bottom: 10px;
  color: var(--privy-color-foreground-3);
  text-align: center;

  font-size: 0.875rem;
  font-style: normal;
  font-weight: 400;
  line-height: 20px; /* 142.857% */
  letter-spacing: -0.008px;
`,lr=c.div`
  position: relative;
  width: 60px;
  height: 60px;
  margin: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
`,dr=c(_e)`
  position: absolute;
  width: 35px;
  height: 35px;
  color: var(--privy-color-error);
`,cr=c.div`
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--privy-color-error);
  opacity: 0.1;
`,xr=c(X)`
  && {
    margin-top: 24px;
  }
  transition:
    color 350ms ease,
    background-color 350ms ease;
`,se=c.span`
  width: 100%;
  text-align: left;
  font-size: 0.825rem;
  color: var(--privy-color-foreground);
  padding: 4px;
`,ne=c.div`
  width: 100%;
  margin: 5px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`,hr=c.text`
  position: relative;
  width: 100%;
  padding: 5px;
  font-size: 0.8rem;
  color: var(--privy-color-foreground-3);
  text-align: left;
  overflow-wrap: break-word;
`,ie=c.span`
  position: relative;
  width: 100%;
  background-color: var(--privy-color-background-2);
  padding: 8px 12px;
  border-radius: 10px;
  margin-top: 5px;
  font-size: 14px;
  color: var(--privy-color-foreground-3);
  text-align: left;
  overflow-wrap: break-word;
  ${a=>a.$clickable&&`cursor: pointer;
  transition: background-color 0.3s;
  padding-right: 45px;

  &:hover {
    background-color: var(--privy-color-foreground-4);
  }`}
`,jr=c(Ye)`
  position: absolute;
  top: 13px;
  right: 13px;
  width: 24px;
  height: 24px;
`,mr=c(We)`
  position: absolute;
  top: 13px;
  right: 13px;
  width: 24px;
  height: 24px;
`,ur=({clicked:a})=>e.jsx(a?mr:jr,{});export{Ar as G,Nr as Q,Lr as t};
