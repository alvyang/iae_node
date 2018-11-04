// var wechat = require('../utils/wechat_util.js');
var crypto = require('crypto');
var pinyin = require('node-pinyin');

//获取返款日期
exports.getReturnTime=function(startDate,returnType,day,dayNum){
  var month = startDate.getMonth();
  day = parseInt(day);
  if(returnType == '1'){
    if(day && month == 1 && day > 28){
      day = 28;
    }else if(day && (month == 3||month == 5||month == 8|| month == 10) && day > 30){
      day = 30;
    }
    startDate.setDate(day);
  }else if(returnType == '2'){
    month = month + 1;
    var monthTemp = month%12;
    if(day && monthTemp == 1 && day > 28){
      day = 28;
    }else if(day && (monthTemp == 3||monthTemp == 5||monthTemp == 8|| monthTemp == 10) && day > 30){
      day = 30;
    }
    startDate.setMonth(month,day);
  }else if(returnType == '3'){
    month = month + 2;
    var monthTemp = month%12;
    if(day && monthTemp == 1 && day > 28){
      day = 28;
    }else if(day && (monthTemp == 3||monthTemp == 5||monthTemp == 8|| monthTemp == 10) && day > 30){
      day = 30;
    }
    startDate.setMonth(month,day);
  }else if(returnType == '4'){
    dayNum = parseInt(dayNum);
    var d = startDate.getDate()+dayNum;
    startDate.setDate(d);
  }
  return startDate;
}
exports.getArrayDuplicateRemoval=function(array1,array2){
  //临时数组存放
  var tempArray1 = [];//临时数组1
  var tempArray2 = [];//临时数组2
  for(var i=0;i<array2.length;i++){
    tempArray1[array2[i]]=true;//将数array2 中的元素值作为tempArray1 中的键，值为true；
  }
  for(var i=0;i<array1.length;i++){
    if(!tempArray1[array1[i]]){
      tempArray2.push(array1[i]);//过滤array1 中与array2 相同的元素；
    }
  }
  return tempArray2;
}
exports.getIntervalMonth = function(d1, d2){
  var months;
  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months
},
exports.add = function(num1,num2,num){//加法
    var r1,r2,m,n;
    try{r1=num1.toString().split(".")[1].length}catch(e){r1=0}
    try{r2=num2.toString().split(".")[1].length}catch(e){r2=0}
    m = Math.pow(10,Math.max(r1,r2));
    n = (r1>=r2)?r1:r2;
    num = num?num:n;
    var a = (num1*m + num2*m)/m;
    num = Math.pow(10,num);
    return Math.round(a*num)/num;
},
exports.sub = function(num1,num2,num){//减法
    var r1,r2,m,n;
    try{r1=num1.toString().split(".")[1].length}catch(e){r1=0}
    try{r2=num2.toString().split(".")[1].length}catch(e){r2=0}
    n = (r1>=r2)?r1:r2;
    num = num?num:n;
    m = Math.pow(10,Math.max(r1,r2));
    var a = (num1*m - num2*m)/m
    num = Math.pow(10,num);
    return Math.round(a*num)/num;
},
exports.mul = function(num1,num2,num){//乘法
    var m = 0;
    try{m+=num1.toString().split(".")[1].length}catch(e){}
    try{m+=num2.toString().split(".")[1].length}catch(e){}
    var a = (Number(num1.toString().replace(".",""))*Number(num2.toString().replace(".","")))/Math.pow(10,m);
    num = num?num:m;
    num = Math.pow(10,num);
    return Math.round(a*num)/num;
},
exports.div = function(arg1,arg2,num){//除法
    var t1=0,t2=0,r1,r2;
    try{t1=arg1.toString().split(".")[1].length}catch(e){}
    try{t2=arg2.toString().split(".")[1].length}catch(e){}
    r1=Number(arg1.toString().replace(".",""));
    r2=Number(arg2.toString().replace(".",""));
    var a = (r1/r2)*Math.pow(10,t2-t1);
    num = num?num:(t2-t1);
    num = Math.pow(10,num);
    return Math.round(a*num)/num;
}
exports.getSixMonth = function(){
  //创建现在的时间
  var data=new Date();
  //获取年
  var year=data.getFullYear();
  //获取月
  var mon=data.getMonth()+1;
  var arry=new Array();
  for(var i=0;i<6;i++){
      var temp = mon - i;
      if(temp<=0){
          year=year-1;
          temp=temp+12;
      }
      if(temp<10){
          temp="0"+temp;
      }

      arry[i]=year+"-"+temp;
  }
  return arry;
}
/*
 * 获取拼音首字母
 */
exports.getFirstLetter = function(str){
  var temp = "";
  pinyin(str, {
    style: "normal"
  }).forEach(function(i){
    temp+=i[0].substring(0,1);
  });
  return temp;
}
/*将数据库查询的结果，格式化成要的形式  excel-export 要求的形式
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
