var express = require("express");
var logger = require('../utils/logger');
var util = require('../utils/global_util');
var router = express.Router();

//新增角色
router.post("/saveRoles",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",11,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var role = DB.get("Role");
  req.body.group_id = req.session.user[0].group_id;
  req.body.role_create_userid = req.session.user[0].id;
  req.body.role_create_time = new Date();
  role.insert(req.body,'role_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增角色出错" + err);
    }
    var message = req.session.user[0].realname+"新增角色。id："+result;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    res.json({"code":"000000",message:result});
  });
});
//编辑角色
router.post("/editRoles",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",12,") > -1){
    var role = DB.get("Role");
  	req.body.group_id = req.session.user[0].group_id;
    delete req.body.role_create_time;
    var front_message = req.body.front_message;
    role.update(req.body,'role_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改角色出错" + err);
      }
      var message = req.session.user[0].realname+"修改角色。";
      util.saveLogs(req.session.user[0].group_id,front_message,JSON.stringify(req.body),message);
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//授权
router.post("/editAuthority",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",15,") > -1){
    var roleAuthority = DB.get("RoleAuthority");
  	//联合主键，存在将删除更新为0。不存在插入
    var sql = "insert into role_authority values ";
    for(var i = 0 ; i < req.body.authority_code.length ; i++){
      sql += "('"+req.body.role_id+"','"+req.body.authority_code[i]+"','"+req.session.user[0].group_id+"','0'),";
    }
    sql = sql.substring(0,sql.length-1);
    sql += " ON DUPLICATE KEY UPDATE role_authority_delete_flag=VALUES(role_authority_delete_flag);"
    //更新权限列表时，先将所有权限标记为删除
    var deleteAllSql = "update role_authority set role_authority_delete_flag = '1' where "+
                      "role_authority_group_id = '"+req.session.user[0].group_id+"' "+
                      "and role_id = '"+req.body.role_id+"'";
    var front_message = req.body.front_message;
    roleAuthority.executeSql(deleteAllSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "授权时，先将权限票房为删除，出错" + err);
      }
      roleAuthority.executeSql(sql,function(err2,result){
        if(err){
          logger.error(req.session.user[0].realname + "授权出错" + err2);
        }
        var message = req.session.user[0].realname+"角色重新授权。";
        util.saveLogs(req.session.user[0].group_id,front_message,req.body.authority_code.toString(),message);
      });
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//删除菜单
router.post("/deleteRoles",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",13,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var role = DB.get("Role");
  req.body.delete_flag = 1;
  delete req.body.role_create_time;
  role.update(req.body,'role_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除角色出错" + err);
    }
    var message = req.session.user[0].realname+"删除角色。id："+req.body.role_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
  });
});
//获取角色列表
router.post("/getRoles",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",14,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var role = DB.get("Role");
  var sql = "select r.*,concat(GROUP_CONCAT(ra.authority_id),',') authority_code from role r left join role_authority ra on r.role_id = ra.role_id "+
            "where (ra.role_authority_delete_flag = '0' || ra.role_authority_delete_flag is null) and (ra.role_authority_group_id = '"+req.session.user[0].group_id+"' || ra.role_authority_group_id is null) "+
            "and r.group_id='"+req.session.user[0].group_id+"' and r.delete_flag = '0' group by r.role_id";
  role.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询角色，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by r.role_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    role.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询角色出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
module.exports = router;
