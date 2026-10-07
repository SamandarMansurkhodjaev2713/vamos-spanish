const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
(async()=>{const b=await chromium.launch(),p=await b.newPage();for(const size of [192,512]){await p.setViewportSize({width:size,height:size});await p.setContent('<style>html,body{margin:0}svg{width:100vw;height:100vh;display:block}</style>'+fs.readFileSync('web/assets/app-icon.svg','utf8'));await p.screenshot({path:'web/assets/app-icon-'+size+'.png',omitBackground:true})}await b.close()})();
