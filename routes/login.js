var express = require("express");
var svgCaptcha = require('svg-captcha');
var router = express.Router();

Date.prototype.format = function(fmt) {
     var o = {
        "M+" : this.getMonth()+1,                 //月份
        "d+" : this.getDate(),                    //日
        "h+" : this.getHours(),                   //小时
        "m+" : this.getMinutes(),                 //分
        "s+" : this.getSeconds(),                 //秒
        "q+" : Math.floor((this.getMonth()+3)/3), //季度
        "S"  : this.getMilliseconds()             //毫秒
    };
    if(/(y+)/.test(fmt)) {
            fmt=fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length));
    }
     for(var k in o) {
        if(new RegExp("("+ k +")").test(fmt)){
             fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
         }
     }
    return fmt;
}

router.post("/login",function(req,res){
	var user = DB.get("User");
	if(req.session.captcha.toLowerCase() != req.body.code.toLowerCase()){
		res.json({"code":"100001",message:"验证码错误"});
	}else{
		delete req.body.code;
		var machineCode = req.body.machineCode;
    var version = req.body.version;
		delete req.body.machineCode;
    delete req.body.version;
		user.where(req.body,null,function(err,result){
      if(result.length == 0){
				res.json({"code":"100000",message:"用户名或密码错误！"});
        return ;
			}
			var startTime = new Date(result[0].start_time);
			var endTime = new Date(result[0].end_time);
			var nowDate = new Date();
			if(nowDate < startTime || nowDate > endTime){
				res.json({"code":"100002",message:{
					startTime:startTime,
					endTime:endTime
				}});
			}else if(result[0].machine_code && result[0].machine_code != machineCode){
				res.json({"code":"100003",message:"该电脑没有授权"});
			}else{
				var time = new Date().format("yyyy-MM-dd");
				if(!result[0].machine_code){//首次登陆记录该机器码
					var sqlCode = "update user set machine_code = '"+machineCode+"',login_time = '"+time+"' where username = '"+req.body.username+"'";
					user.executeSql(sqlCode);
				}else{
					var sqlCode = "update user set login_time = '"+time+"',version = '"+version+"' where username = '"+req.body.username+"'";
					user.executeSql(sqlCode);
				}
				req.session.user=result;
				res.json({"code":"000000",message:"登录成功！"});
			}
		});
	}
});
router.post("/password",function(req,res){
	var user = DB.get("User");
  delete req.body.code;
  var modifyPass = req.body.pass;
  delete req.body.pass;
  delete req.body.checkPass;
  user.where(req.body,null,function(err,result){
    if(result.length == 0){
      res.json({"code":"100000",message:"旧密码错误！"});
      return;
    }
    var sqlCode = "update user set password = '"+modifyPass+"' where username = '"+req.body.username+"'";
    user.executeSql(sqlCode);
    res.json({"code":"000000",message:"修改成功！"});
  });
});
router.get("/captcha",function(req,res){
	var captcha = svgCaptcha.create();
	req.session.captcha = captcha.text;
  res.type('svg');
  res.status(200).send(captcha.data);
});
module.exports = router;
