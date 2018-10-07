var express = require("express");
var logger = require('../utils/logger');
var router = express.Router();

//新增角色
router.post("/saveRoles",function(req,res){
  if(req.session.user[0].authority_code.indexOf("11") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var role = DB.get("Role");
  req.body.group_id = req.session.user[0].group_id;
  role.insert(req.body,'role_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增角色出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//编辑角色
router.post("/editRoles",function(req,res){
  if(req.session.user[0].authority_code.indexOf("12") > -1 || req.session.user[0].authority_code.indexOf("15") > -1){
    var role = DB.get("Role");
  	req.body.group_id = req.session.user[0].group_id;
    role.update(req.body,'role_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改角色出错" + err);
      }
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//删除菜单
router.post("/deleteRoles",function(req,res){
  if(req.session.user[0].authority_code.indexOf("13") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var role = DB.get("Role");
  req.body.delete_flag = 1;
  role.update(req.body,'role_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除角色出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});
//获取角色列表
router.post("/getRoles",function(req,res){
  if(req.session.user[0].authority_code.indexOf("14") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var role = DB.get("Role");
  req.body.data.group_id = req.session.user[0].group_id;
  req.body.data.delete_flag = 0;
  role.queryPage(req.body.page,req.body.data,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询角色出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
