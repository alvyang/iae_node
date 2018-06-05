// var wechat = require('../utils/wechat_util.js');
var crypto = require('crypto');

/*
 *将数据库查询的结果，格式化成要的形式  excel-export 要求的形式
 header:数据库字段名数组   data 要格式化的数据
 */
exports.formatExcel = function(header,data){
  var fData=[];
  for(var i = 0 ; i < data.length ;i++){
    var temp = [];
    for(var j = 0 ; j < header.length ; j++){
      var v = data[i][header[j]]?data[i][header[j]].toString():"";
      temp.push(v);
    }
    fData.push(temp);
  }
  return fData;
}

/*
 * 生成随机字符串
 */
exports.randomString = function(len) {
　　len = len || 32;
　　var $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789';
　　var maxPos = $chars.length;
　　var pwd = '';
　　for (i = 0; i < len; i++) {
　　　　pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
　　}
　　return pwd;
}
/*
 * @params ret : 需要加密的对象
 * @return string : 加密后的字符串，并转换成大写
 */
exports.strEncryption = function(ret){
    var str = raw(ret);
    return crypto.createHash('sha1').update(str,'utf8').digest('hex');
};

/*
 * @params ret : 需要加密的对象
 * @return string : 加密后的字符串，并转换成大写
 */
exports.wechatPayNotify = function(ret) {
	var str = raw(ret);
	str += "&key=12312323";
  	return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
};

/*
 * @params args : 任意对象
 * @return str : 将args 拼接成get方式的字符串
 */
function raw(args){
	var keys = Object.keys(args).sort();
	var newArgs = {};
  	keys.forEach(function (key) {
    	newArgs[key] = args[key];
  	});
  	var str = '';
    for (var k in newArgs) {
    	str += '&' + k + '=' + newArgs[k];
    }
    str = str.substr(1);
    return str;
};
