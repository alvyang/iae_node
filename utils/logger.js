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
exports.error=function(err){
	if(err){
			var errorLogfile = fs.createWriteStream(path, {flags: 'a',encoding:'utf8'});
      // errorLogfile.open();
      if(err instanceof  Error){
          var meta = '\n[' + moment(new Date()).format('YYYY-MM-DD HH:mm:ss') + '] [ERROR] ' +err.stack ;
          errorLogfile.write(meta);
      }else{
          errorLogfile.write('\n[' + moment(new Date()).format('YYYY-MM-DD HH:mm:ss') + '] [ERROR] ' +err);
      }
      errorLogfile.close();
	}
}
exports.debug=function(obj){
	if(conf.logger_level==="debug" && obj!=null){
		var errorLogfile = fs.createWriteStream(path, {flags: 'a',encoding:'utf8'});
		// errorLogfile.open();
		//console.log("\n["+moment(new Date()).format('YYYY-MM-DD HH:mm:ss')+"][DEBUG] "+obj);
		errorLogfile.write('\n[' + moment(new Date()).format('YYYY-MM-DD HH:mm:ss') + '] [DEBUG] ' +obj);
		errorLogfile.close();
	}
}
