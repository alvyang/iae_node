var express = require("express");
var svgCaptcha = require('svg-captcha');
var router = express.Router();

router.post("/login",function(req,res){
	var user = DB.get("User");
	if(req.session.captcha.toLowerCase() != req.body.code.toLowerCase()){
		res.json({"code":"100001",message:"验证码错误"});
	}else{
		delete req.body.code;
		user.where(req.body,null,function(err,result){
			var startTime = new Date(result[0].start_time);
			var endTime = new Date(result[0].end_time);
			var nowDate = new Date();
			if(result.length == 0){
				res.json({"code":"100000",message:"用户名或密码错误！"});
			}else if(nowDate < startTime || nowDate > endTime){
				res.json({"code":"100002",message:{
					startTime:startTime,
					endTime:endTime
				}});
			}else{
				req.session.user=result;
				res.json({"code":"000000",message:"登录成功！"});
			}
		});
	}
});
router.get("/captcha",function(req,res){
	var captcha = svgCaptcha.create();
	req.session.captcha = captcha.text;
  res.type('svg');
  res.status(200).send(captcha.data);
});
module.exports = router;
