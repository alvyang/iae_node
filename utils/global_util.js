// var wechat = require('../utils/wechat_util.js');
var crypto = require('crypto');
var pinyin = require('node-pinyin');
var logger = require('../utils/logger');
var uuid=require("node-uuid");

exports.isEmptyAndZero = function(value){
  if(typeof value == "string"){
    value = value.replace(/\s/g,"");
  }
	if(value == null || value == "" || value == "undefined" || value == undefined || value == "null" || value == "0" || value == "NaN"){
		return true;
	}else{
		return false;
	}
}
exports.isEmpty = function(value){
  if(typeof value == "string"){
    value = value.replace(/\s/g,"");
  }
	if(value == null || value == "" || value == "undefined" || value == undefined || value == "null"  || value == "NaN"){
		return true;
	}else{
		return false;
	}
}

//计算应付
exports.getShouldPayMoney = function(formula,price,money,percent,otherMoney,sp){
  otherMoney=otherMoney?otherMoney:0;
  price = price?price:0;
  money = money?money:0;
  percent = percent?percent:0;
  sp = sp?sp:0;
  var shouldPay = 0;
  switch (formula) {
    case "1":
      shouldPay = price*percent/100;
      break;
    case "2":
      shouldPay = price*percent/100-otherMoney;
      break;
    case "3":
      shouldPay = money*percent/100;
      break;
    case "4":
      shouldPay = money*percent/100-otherMoney;
      break;
    case "5":
      shouldPay = money - price*percent/100;
      break;
    case "6":
      shouldPay = money - price*percent/100-otherMoney;
      break;
    case "7":
      var temp = price*percent/100;
      shouldPay = money > temp?temp:money;
      break;
    case "8":
      shouldPay = sp;
      break;
    case "9":
      var temp = price*percent/100;
      shouldPay = money > temp?money-price*0.03-otherMoney:money-otherMoney;
      break;
    case "10":
      var temp = price*percent/100;
      shouldPay = money > temp?money-price*0.05-otherMoney:money-otherMoney;
      break;
    default:
      shouldPay = 0
  }
  return shouldPay;
}
//保存日志
exports.saveLogs = function(arg1,arg2,arg3,arg4){
  var log = DB.get("Log");
  var temp = {
    log_group_id:arg1,
    log_front_message:arg2,
    log_after_message:arg3,
    log_remark:arg4,
    log_create_time:new Date()
  }
  log.insert(temp,'log_id',function(err,result){
    if(err){
      logger.error("新增日志出错" + err);
    }
  });
}
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
//获取某月最后一天日期
exports.getLastDateOfMonth = function(year, month) {
  return new Date(new Date(year, month + 1, 1).getTime() - 1000 * 60 * 60 * 24);
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
//获取n月日期
exports.getnMonth = function(n,data){
  //获取年
  var year=data.getFullYear();
  //获取月
  var month=data.getMonth()+1;
  var arry=new Array();
  var flag = true;
  for(var i=0;i<n;i++){
      var mon = month - i;
      if(mon<=0 && flag){
        year=year-1;
        flag = false;
      }
      if(mon<=0){
        mon =mon+12;
      }
      if(mon<10){
          mon="0"+mon;
      }
      arry[i]=year+"-"+mon;
  }
  return arry;
}
//获取6个月日期
exports.getSixMonth = function(){
  //创建现在的时间
  var data=new Date();
  //获取年
  var year=data.getFullYear();
  //获取月
  var month=data.getMonth()+1;
  var arry=new Array();
  var flag = true;
  for(var i=0;i<6;i++){
      var mon = month - i;
      if(mon<=0 && flag){
        year=year-1;
        flag = false;
      }
      if(mon<=0){
        mon =mon+12;
      }
      if(mon<10){
          mon="0"+mon;
      }
      arry[i]=year+"-"+mon;
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
