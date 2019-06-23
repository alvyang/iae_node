var express = require("express");
var logger = require('../utils/logger');
var util = require('../utils/global_util');
var router = express.Router();

//用户组权限授权，用于按功能付费
router.post("/editGroupAuthority",function(req,res){
  //联合主键，存在将删除更新为0。不存在插入
  var sql = "insert into groups_authority values ";
  for(var i = 0 ; i < req.body.authority_code.length ; i++){
    sql += "('"+req.body.group_id+"','"+req.body.authority_code[i]+"','0'),";
  }
  sql = sql.substring(0,sql.length-1);
  sql += " ON DUPLICATE KEY UPDATE groups_authority_delete_flag=VALUES(groups_authority_delete_flag);"
  //更新权限列表时，先将所有权限标记为删除
  var deleteAllSql = "update groups_authority set groups_authority_delete_flag = '1' where "+
                    "groups_authority_group_id = '"+req.body.group_id+"' ";
  var groupsAuthority = DB.get("GroupsAuthority");
  var front_authority_code = req.body.front_authority_code;
  groupsAuthority.executeSql(deleteAllSql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "组授权时，先将权限标记为删除，出错" + err);
    }
    groupsAuthority.executeSql(sql,function(err2,result){
      if(err){
        logger.error(req.session.user[0].realname + "组授权出错" + err2);
      }
      var message = req.session.user[0].realname+"用户组重新授权。";
      util.saveLogs(req.session.user[0].group_id,front_authority_code,req.body.authority_code.toString(),message);
    });
    res.json({"code":"000000",message:null});
  });
});
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
  if(req.session.user[0].authority_code.indexOf(",20,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var group = DB.get("Groups");
  req.body.start_time = new Date(req.body.start_time).format('yyyy-MM-dd');
  req.body.end_time = new Date(req.body.end_time).format('yyyy-MM-dd');
  req.body.group_create_time = new Date();
  req.body.group_create_userid = req.session.user[0].id;
  group.insert(req.body,'group_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增用户组出错" + err);
    }
    var message = req.session.user[0].realname+"新增用户组。id："+result;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    res.json({"code":"000000",message:result});
  });
});
//编辑菜单
router.post("/editGroups",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",21,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  delete req.body.group_create_time;
  var group = DB.get("Groups");
  req.body.start_time = new Date(req.body.start_time).format('yyyy-MM-dd');
  req.body.end_time = new Date(req.body.end_time).format('yyyy-MM-dd');
  var sql = "update groups set `group_code`='"+req.body.group_code+"',`group_name` = '"+req.body.group_name+"', `start_time` = '"+req.body.start_time+"', `end_time` = '"+req.body.end_time+"'";
  sql += " where group_id = '"+req.body.group_id+"'";
  var front_message = req.body.front_message;
  group.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改用户组出错" + err);
    }
    var message = req.session.user[0].realname+"修改用户组。";
    util.saveLogs(req.session.user[0].group_id,front_message,JSON.stringify(req.body),message);
    res.json({"code":"000000",message:null});
  });
});
//删除菜单
router.post("/deleteGroups",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",22,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var group = DB.get("Groups");
  req.body.delete_flag = 1;
  group.update(req.body,'group_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除用户组出错" + err);
    }
    var message = req.session.user[0].realname+"删除用户组。id："+req.body.group_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
  });
});
//获取角色列表
router.post("/getGroups",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",23,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var group = DB.get("Groups");
  var sql = "select g.*,concat(GROUP_CONCAT(ga.groups_authority_id),',') authority_code from groups g left join groups_authority ga on g.group_id = ga.groups_authority_group_id "+
            "where g.delete_flag = '0' and (ga.groups_authority_delete_flag = '0' || ga.groups_authority_delete_flag is null) ";
  if(!util.isEmpty(req.body.data.group_name)){
    sql+="and g.group_name like '%"+req.body.data.group_name+"%'"
  }
  sql += " group by g.group_id";
  group.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询用户组列表，统计总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by g.group_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    group.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询用户组列表出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
router.post("/getAllGroups",function(req,res){
  var group = DB.get("Groups");
  var sql = "select * from groups g where g.delete_flag = '0' ";
  if(req.session.user[0].username != 'admin'){
    sql += " and g.group_id = '"+req.session.user[0].group_id+"'";
  }
  group.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询所有用户组出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
