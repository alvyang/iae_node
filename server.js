var express = require('express');
var path = require('path');
var fs=require("fs");
var morgan = require('morgan');//输出日志
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multiparty=require("connect-multiparty");
var session=require("express-session");

//Express配置
var app = express();
//app.use(morgan('dev'));
app.use(multiparty());

require("body-parser-xml")(bodyParser);
app.use(bodyParser.xml({
    limit: "1MB",   // Reject payload bigger than 1 MB
	  xmlParseOptions: {
	    normalize: true,     // Trim whitespace inside text nodes
	    normalizeTags: true, // Transform tags to lowercase
	    explicitArray: false // Only put nodes in array if >1
	  }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(session({secret:'lvyang',cookie:{maxAge: 60000*30 },saveUninitialized:true,resave:true}));

global.logger=require("./utils/logger.js");
global.moment = require('moment');//日期函数全局访问
global.moment.locale('zh-cn');
global.DB=require("./utils/dbutil.js").Instance();

//Session拦截控制
app.all('/*', function(req,res,next){
  var url = req.url.split("/");
  var keyWords = url[url.length-1].split("?")[0];
  if(keyWords == "captcha" || keyWords == "login" || req.session.user){
    next();
  }else{
    res.json({"code":"111111",message:"请先登陆"});
  }
});

///定义实体
app.set('entity',__dirname + '/entity/');
var entity=app.get("entity");
fs.readdirSync(entity).forEach(function(fileName) {
    var filePath = entity + fileName;
    if(!fs.lstatSync(filePath).isDirectory()) {
		DB.define(require(filePath));
    }
});
//控制层_根据routes文件名+方法_约定请求路径
app.set('routes',__dirname + '/routes/');
var routes=app.get("routes");
fs.readdirSync(routes).forEach(function(fileName) {
    var filePath = routes + fileName;
    var rname=fileName.substr(0,fileName.lastIndexOf("."));
    if(!fs.lstatSync(filePath).isDirectory()) {
       app.use("/iae/"+rname,require(filePath));
    }
});
///404
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    res.status(err.status || 500);
});

///500
app.use(function(err, req, res){
    logger.error(err);
    res.status(err.status || 500);
});

app.listen(5000);
