var express = require("express");
var logger = require('../utils/logger');
var util = require('../utils/global_util');
var router = express.Router();

//验证产品编码是否存在
router.post("/exitsContactsName",function(req,res){
  var contacts = DB.get("Contacts");
  var params={
    contacts_name:req.body.contact.contacts_name,
    group_id:req.session.user[0].group_id,
    delete_flag:'0'
  }
  contacts.where(params,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "验证联系人是否存在出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//新增联系人
router.post("/saveContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",32,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var contacts = DB.get("Contacts");
  req.body.group_id = req.session.user[0].group_id;
  req.body.contact_type = req.body.contact_type.join(",");
  req.body.contact_create_time = new Date();
  req.body.contact_create_userid = req.session.user[0].id;
  contacts.insert(req.body,'contacts_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增联系人出错" + err);
    }
    var message = req.session.user[0].realname+"新增联系人。id："+result;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    res.json({"code":"000000",message:result});
  });
});
//编辑联系人
router.post("/editContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",33,") > -1){
    var contacts = DB.get("Contacts");
  	req.body.group_id = req.session.user[0].group_id;
    req.body.contact_type = req.body.contact_type.join(",");
    delete req.body.contact_create_time;
    delete req.body.contact_create_time;
    var front_message = req.body.front_message;
    contacts.update(req.body,'contacts_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改联系人出错" + err);
      }
      var message = req.session.user[0].realname+"修改联系人。";
      util.saveLogs(req.session.user[0].group_id,front_message,JSON.stringify(req.body),message);
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//删除联系人
router.post("/deleteContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",34,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var contacts = DB.get("Contacts");
  req.body.delete_flag = 1;
  contacts.update(req.body,'contacts_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除联系人出错" + err);
    }
    var message = req.session.user[0].realname+"删除联系人。id："+req.body.contacts_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
  });
});
//获取联系人列表
router.post("/getContacts",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",35,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var contacts = DB.get("Contacts");
  var sql = "select * from contacts c where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.data.contacts_name){
    sql += " and c.contacts_name like '%"+req.body.data.contacts_name+"%'";
  }
  if(req.body.data.contact_type){
    sql += " and c.contact_type like '%"+req.body.data.contact_type+"%'";
  }
  contacts.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询联系人，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by c.contact_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    contacts.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询联系人出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
//获取联系人列表
router.post("/getAllContacts",function(req,res){
  var contacts = DB.get("Contacts");
  req.body.group_id = req.session.user[0].group_id;
  req.body.delete_flag = 0;
  var sql = "select * from contacts c where c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"' ";
  var type="(";
  if(req.body.contact_type){
    for(var i = 0 ; i < req.body.contact_type.length ;i++){
      type+=" c.contact_type like '%"+req.body.contact_type[i]+"%' ||";
    }
    type = type.substring(0,type.length-2)+")";
  }
  sql += " and "+type +" order by c.contact_create_time";
  contacts.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询联系人，查询所有联系出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
