var express = require("express");
var crypto = require('crypto');
var router = express.Router();

//判断用户是否存在
router.post("/exitsUsers",function(req,res){
  var user = DB.get("Users");
  req.body.group_id = req.session.user[0].group_id;
  req.body.delete_flag = 0;
  user.where(req.body,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
//新增角色
router.post("/saveUsers",function(req,res){
  var user = DB.get("Users");
  var md5 = crypto.createHash('md5');
  req.body.group_id = req.session.user[0].group_id;
  req.body.password = md5.update(req.body.password).digest('base64');
  user.insertIncrement(req.body,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
//编辑菜单
router.post("/editUsers",function(req,res){
  var user = DB.get("Users");
  var md5 = crypto.createHash('md5');
	req.body.group_id = req.session.user[0].group_id;
  if(req.body.username != req.session.user[0].username){
    req.body.password = md5.update(req.body.password).digest('base64');
  }
  delete req.body.login_time;
  delete req.body.role_id;
  delete req.body.role_name;
  user.update(req.body,'id',function(err,result){
    res.json({"code":"000000",message:null});
  });
});
//编辑菜单
router.post("/editUserRole",function(req,res){
  var user = DB.get("Users");
	req.body.group_id = req.session.user[0].group_id;
  user.update(req.body,'id',function(err,result){
    res.json({"code":"000000",message:null});
  });
});
//删除菜单
router.post("/deleteUsers",function(req,res){
  var user = DB.get("Users");
  req.body.delete_flag = 1;
  user.update(req.body,'id',function(err,result){
    res.json({"code":"000000",message:null});
  });
});
//获取用户列表
router.post("/getUsers",function(req,res){
  var user = DB.get("Users");
  var sql = "select u.*,r.role_name from users u left join role r on u.role_id = r.role_id where u.group_id = '"+req.session.user[0].group_id+"' and u.delete_flag = '0'";
  if(req.body.data.username){
    sql += " and u.username like '%"+req.body.data.username+"%'";
  }
  user.countBySql(sql,function(err,result){
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " limit " + req.body.page.start + "," + req.body.page.limit + "";
    user.executeSql(sql,function(err,result){

      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});

module.exports = router;
