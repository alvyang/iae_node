var express = require("express");
var logger = require('../utils/logger');
var router = express.Router();

//判断用户组是否存在
router.post("/exitsGroup",function(req,res){
  var group = DB.get("Groups");
  req.body.delete_flag = 0;
  group.where(req.body,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "判断用户组是否存在出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//新增组
router.post("/saveGroups",function(req,res){
  if(req.session.user[0].authority_code.indexOf("20") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var group = DB.get("Groups");
  req.body.start_time = new Date(req.body.start_time).format('yyyy-MM-dd');
  req.body.end_time = new Date(req.body.end_time).format('yyyy-MM-dd');
  var sql = "insert into groups set `group_code`='"+req.body.group_code+"',`group_name` = '"+req.body.group_name+"', `start_time` = '"+req.body.start_time+"', `end_time` = '"+req.body.end_time+"'";
  group.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增用户组出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//编辑菜单
router.post("/editGroups",function(req,res){
  if(req.session.user[0].authority_code.indexOf("21") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var group = DB.get("Groups");
  req.body.start_time = new Date(req.body.start_time).format('yyyy-MM-dd');
  req.body.end_time = new Date(req.body.end_time).format('yyyy-MM-dd');
  var sql = "update groups set `group_code`='"+req.body.group_code+"',`group_name` = '"+req.body.group_name+"', `start_time` = '"+req.body.start_time+"', `end_time` = '"+req.body.end_time+"'";
  sql += " where group_id = '"+req.body.group_id+"'";
  group.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改用户组出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});
//删除菜单
router.post("/deleteGroups",function(req,res){
  if(req.session.user[0].authority_code.indexOf("22") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var group = DB.get("Groups");
  req.body.delete_flag = 1;
  group.update(req.body,'group_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除用户组出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});
//获取角色列表
router.post("/getGroups",function(req,res){
  if(req.session.user[0].authority_code.indexOf("23") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var group = DB.get("Groups");
  req.body.data.delete_flag = 0;
  group.queryPage(req.body.page,req.body.data,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询用户组出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
