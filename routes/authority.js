var express = require("express");
var logger = require('../utils/logger');
var router = express.Router();

//新增菜单
router.post("/saveAuthoritys",function(req,res){
  if(req.session.user[0].authority_code.indexOf("7") < 0){
    res.json({"code":"111112",message:"无权限"});
    return;
  }
  var authority = DB.get("Authority");
	delete req.body.label;
  authority.insert(req.body,'authority_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增权限出错" + err);
      res.json({"code":"100000",message:"查询菜单出错"});
    }else{
      res.json({"code":"000000",message:result});
    }
  });
});
//编辑菜单
router.post("/editAuthoritys",function(req,res){
  if(req.session.user[0].authority_code.indexOf("8") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var authority = DB.get("Authority");
  delete req.body.label;
  delete req.body.id;
  authority.update(req.body,'authority_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改权限出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});
//线性数据转化为树。
function toTree(data, parent_id) {
    var tree = [];
    var temp;
    for (var i = 0; i < data.length; i++) {
        if (data[i].authority_parent_id == parent_id) {
            var obj = data[i];
            temp = toTree(data, data[i].authority_id);
            if (temp.length > 0) {
             obj.children = temp;
           }else{
             obj.children = [];
           }
            tree.push(obj);
        }
    }
    return tree;
}
//获得全部菜单
router.post("/getAuthoritys",function(req,res){
  var authority = DB.get("Authority");
  authority.where({delete_flag:0},{authority_code:"desc"},function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询权限出错" + err);
      res.json({"code":"100000",message:"查询菜单出错"});
    }else{
      for(var i = 0 ; i < result.length ; i++){
        result[i].label = result[i].authority_name;
        result[i].id = result[i].authority_id;
      }
      res.json({"code":"000000",message:toTree(result,null)});
    }
  });
});
//获得对外开放的菜单
router.post("/getOpenAuthoritys",function(req,res){
  var authority = DB.get("Authority");
  var temp = {delete_flag:0};
  if(req.session.user[0].username != "admin"){
    temp.authority_open = 1;
  }
  authority.where(temp,{authority_code:"desc"},function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询权限出错" + err);
      res.json({"code":"100000",message:"查询菜单出错"});
    }else{
      for(var i = 0 ; i < result.length ; i++){
        result[i].label = result[i].authority_name;
        result[i].id = result[i].authority_id;
      }
      res.json({"code":"000000",message:toTree(result,null)});
    }
  });
});
//获取权限列表
router.post("/getAuthoritysList",function(req,res){
  var authority = DB.get("Authority");
  var sql = "select * from authority a where a.delete_flag = '0' and a.authority_id in ("+"1,"+req.body.authority_code+") order by authority_code desc";
  authority.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询权限出错" + err);
      res.json({"code":"100000",message:"查询权限出错"});
    }else{
      res.json({"code":"000000",message:toTree(result,null)});
    }
  });
});

module.exports = router;
