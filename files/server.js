// Servidor mínimo, sem dependências. Uso: node server.js  ->  http://localhost:3000
// Lê e grava as informações no arquivo data.json.
const http=require("http"),fs=require("fs"),path=require("path");
const PORT=process.env.PORT||3000, DIR=__dirname, DATA=path.join(DIR,"data.json");
const TYPES={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8"};

http.createServer((req,res)=>{
  const url=new URL(req.url,"http://x").pathname;
  if(url==="/api/data"){
    if(req.method==="GET"){
      return fs.readFile(DATA,"utf8",(e,t)=>{res.writeHead(e?500:200,{"Content-Type":TYPES[".json"]});res.end(e?"{}":t)});
    }
    if(req.method==="POST"){
      let body="";
      req.on("data",c=>{body+=c;if(body.length>1e6)req.destroy()});
      req.on("end",()=>{
        try{
          const d=JSON.parse(body);
          if(!Array.isArray(d.days)||!Array.isArray(d.places))throw 0;
          const tmp=DATA+".tmp";
          fs.writeFileSync(tmp,JSON.stringify(d,null,2));
          fs.renameSync(tmp,DATA);
          res.writeHead(200);res.end("ok");
        }catch(e){res.writeHead(400);res.end("JSON inválido")}
      });
      return;
    }
    res.writeHead(405);return res.end();
  }
  const file=path.join(DIR,url==="/"?"index.html":url);
  if(!file.startsWith(DIR+path.sep)||["server.js"].includes(path.basename(file))){res.writeHead(403);return res.end()}
  fs.readFile(file,(e,buf)=>{
    if(e){res.writeHead(404);return res.end("Não encontrado")}
    res.writeHead(200,{"Content-Type":TYPES[path.extname(file)]||"application/octet-stream"});res.end(buf);
  });
}).listen(PORT,()=>console.log(`Viver Rio em http://localhost:${PORT}  (dados em data.json)`));
