var express = require("express");
var router = express.Router();

//新增组
router.post("/saveGroups",function(req,res){
  var group = DB.get("Groups");
  req.body.start_time = new Date(req.body.start_time).format('yyyy-MM-dd');
  req.body.end_time = new Date(req.body.end_time).format('yyyy-MM-dd');
  var sql = "insert into groups set `group_name` = '"+req.body.group_name+"', `start_time` = '"+req.body.start_time+"', `end_time` = '"+req.body.end_time+"'";
  group.executeSql(sql,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
//编辑菜单
router.post("/editGroups",function(req,res){
  var group = DB.get("Groups");
  req.body.start_time = new Date(req.body.start_time).format('yyyy-MM-dd');
  req.body.end_time = new Date(req.body.end_time).format('yyyy-MM-dd');
  var sql = "update groups set `group_name` = '"+req.body.group_name+"', `start_time` = '"+req.body.start_time+"', `end_time` = '"+req.body.end_time+"'";
  sql += " where group_id = '"+req.body.group_id+"'";
  group.executeSql(sql,function(err,result){
    res.json({"code":"000000",message:null});
  });
});
//删除菜单
router.post("/deleteGroups",function(req,res){
  var group = DB.get("Groups");
  req.body.delete_flag = 1;
  group.update(req.body,'group_id',function(err,result){
    res.json({"code":"000000",message:null});
  });
});
//获取角色列表
router.post("/getGroups",function(req,res){
  var group = DB.get("Groups");
  req.body.data.delete_flag = 0;
  group.queryPage(req.body.page,req.body.data,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
