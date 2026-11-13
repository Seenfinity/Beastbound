import{bY as j,d5 as n,dh as $,d6 as o}from"./main-zE9T7OVV.js";import{m as g,l as a,o as d,c as h}from"./ethers-DZbkxEbN-D7b5EeyY.js";import{r as k}from"./getFormattedUsdFromLamports-De3U9GlO-C446pzMl.js";import{t as y}from"./transaction-BNTP-bFm-CrebgH-D.js";const O=({weiQuantities:e,tokenPrice:r,tokenSymbol:s})=>{let t=a(e),i=r?d(t,r):void 0,l=h(t,s);return n.jsx(c,{children:i||l})},P=({weiQuantities:e,tokenPrice:r,tokenSymbol:s})=>{let t=a(e),i=r?d(t,r):void 0,l=h(t,s);return n.jsx(c,{children:i?n.jsxs(n.Fragment,{children:[n.jsx(S,{children:"USD"}),i==="<$0.01"?n.jsxs(x,{children:[n.jsx(p,{children:"<"}),"$0.01"]}):i]}):l})},D=({quantities:e,tokenPrice:r,tokenSymbol:s="SOL",tokenDecimals:t=9})=>{let i=e.reduce(((u,f)=>u+f),0n),l=r&&s==="SOL"&&t===9?k(i,r):void 0,m=s==="SOL"&&t===9?y(i):`${j(i,t)} ${s}`;return n.jsx(c,{children:l?n.jsx(n.Fragment,{children:l==="<$0.01"?n.jsxs(x,{children:[n.jsx(p,{children:"<"}),"$0.01"]}):l}):m})};let c=o.span`
  font-size: 14px;
  line-height: 140%;
  display: flex;
  gap: 4px;
  align-items: center;
`,S=o.span`
  font-size: 12px;
  line-height: 12px;
  color: var(--privy-color-foreground-3);
`,p=o.span`
  font-size: 10px;
`,x=o.span`
  display: flex;
  align-items: center;
`;function v(e,r){return`https://explorer.solana.com/account/${e}?chain=${r}`}const F=e=>n.jsx(b,{href:e.chainType==="ethereum"?g(e.chainId,e.walletAddress):v(e.walletAddress,e.chainId),target:"_blank",children:$(e.walletAddress)});let b=o.a`
  &:hover {
    text-decoration: underline;
  }
`;export{F as S,D as f,P as h,O as p};
