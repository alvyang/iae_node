/**
*LOGGER File
**/
var fs = require('fs');
var conf=require("./config.js");
var moment=require('moment');
var path=conf.logger_path;
path+="_"+moment(new Date()).format('YYYY-MM-DD');

/*
记录日志
*/
exports.error=function(obj){
	if(obj){
			var errorLogfile = fs.createWriteStream(path, {flags: 'a',encoding:'utf8'});
      // errorLogfile.open();
      if(obj instanceof  Error){
          var meta = '\n[' + moment(new Date()).format('YYYY-MM-DD HH:mm:ss') + '] [ERROR] ' +obj.stack ;
          errorLogfile.write(meta);
      }else{
          errorLogfile.write('\n[' + moment(new Date()).format('YYYY-MM-DD HH:mm:ss') + '] [ERROR] ' +obj);
      }
      errorLogfile.end();
	}
}
exports.debug=function(obj){
	if(conf.logger_level==="debug" && obj!=null){
		var errorLogfile = fs.createWriteStream(path, {flags: 'a',encoding:'utf8'});
		// errorLogfile.open();
		//console.log("\n["+moment(new Date()).format('YYYY-MM-DD HH:mm:ss')+"][DEBUG] "+obj);
		errorLogfile.write('\n[' + moment(new Date()).format('YYYY-MM-DD HH:mm:ss') + '] [DEBUG] ' +obj);
		errorLogfile.end();
	}
}
